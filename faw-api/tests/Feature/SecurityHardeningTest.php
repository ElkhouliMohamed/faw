<?php

namespace Tests\Feature;

use App\Models\User;
use Filament\Auth\Pages\Login;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_responses_carry_security_headers_without_hsts_on_http(): void
    {
        $r = $this->getJson('/api/categories')->assertOk();
        $r->assertHeader('X-Content-Type-Options', 'nosniff');
        $r->assertHeader('X-Frame-Options', 'DENY');
        $r->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        $this->assertStringContainsString('camera=()', $r->headers->get('Permissions-Policy'));
        $this->assertStringContainsString("default-src 'none'", $r->headers->get('Content-Security-Policy'));
        $r->assertHeaderMissing('Strict-Transport-Security');
    }

    public function test_admin_keeps_a_filament_compatible_csp_and_no_store(): void
    {
        $r = $this->get('/admin/login')->assertOk();
        $this->assertStringContainsString("frame-ancestors 'none'", $r->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString("script-src 'self'", $r->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString('no-store', $r->headers->get('Cache-Control'));
        $r->assertHeader('Referrer-Policy', 'no-referrer');
    }

    public function test_hsts_only_on_https_in_production(): void
    {
        $this->get('https://localhost/api/categories')->assertHeaderMissing('Strict-Transport-Security'); // testing env
        $this->app['env'] = 'production';
        $this->get('http://localhost/api/categories')->assertHeaderMissing('Strict-Transport-Security');
        $this->get('https://localhost/api/categories')->assertHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    public function test_session_cookie_is_httponly_lax_and_secure_over_https(): void
    {
        $cookie = collect($this->get('https://localhost/admin/login')->headers->getCookies())->first(fn ($c) => $c->getName() === config('session.cookie'));
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertTrue($cookie->isSecure());
        $this->assertSame('lax', strtolower((string) $cookie->getSameSite()));
    }

    public function test_session_id_is_regenerated_on_login(): void
    {
        $user = User::factory()->create(['role' => 'viewer', 'password' => Hash::make('local-test-only-password')]);
        $this->get('/admin/login');
        $before = session()->getId();
        Livewire::test(Login::class)->fillForm(['email' => $user->email, 'password' => 'local-test-only-password'])->call('authenticate')->assertHasNoFormErrors();
        $this->assertAuthenticatedAs($user);
        $this->assertNotSame($before, session()->getId());
    }

    public function test_private_disk_has_no_generic_serving_route_and_owner_only_permissions(): void
    {
        $this->assertFalse(Route::has('storage.local'));
        $this->assertFalse(Route::has('storage.local.upload'));
        $path = Storage::disk('local')->put('sav', UploadedFile::fake()->create('p.jpg', 4, 'image/jpeg'));
        $full = Storage::disk('local')->path($path);
        $this->assertSame(0600, fileperms($full) & 0777);
        Storage::disk('local')->delete($path);
    }

    public function test_secure_files_command_restricts_quote_pdfs(): void
    {
        $dir = '/tmp/faw-perm-test-'.bin2hex(random_bytes(4));
        mkdir($dir, 0755);
        file_put_contents($dir.'/Devis-1-FAW.pdf', '%PDF');
        chmod($dir.'/Devis-1-FAW.pdf', 0644);
        config(['faw.output' => $dir]);
        $this->artisan('faw:secure-files')->assertSuccessful();
        clearstatcache();
        $this->assertSame(0600, fileperms($dir.'/Devis-1-FAW.pdf') & 0777);
        $this->assertSame(0700, fileperms($dir) & 0777);
        unlink($dir.'/Devis-1-FAW.pdf');
        rmdir($dir);
    }
}
