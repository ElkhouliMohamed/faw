<?php

namespace Tests\Feature;

use App\Filament\Pages\Auth\EditProfile;
use App\Models\User;
use Filament\Auth\MultiFactor\App\AppAuthentication;
use Filament\Auth\Pages\Login;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Livewire\Livewire;
use Tests\TestCase;

class AdminProfileTest extends TestCase
{
    use RefreshDatabase;

    private const OLD = 'ancien-mot-de-passe-test';

    private function user(string $role = 'viewer'): User
    {
        return User::create(['name' => 'Test', 'email' => $role.'@example.test', 'password' => self::OLD, 'role' => $role, 'is_active' => true]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Filament::setCurrentPanel(Filament::getPanel('admin'));
    }

    public function test_profile_page_is_for_logged_in_users_only(): void
    {
        $this->get('/admin/profile')->assertRedirect('/admin/login');
        $this->actingAs($this->user())->get('/admin/profile')->assertOk()->assertSee('Nouveau mot de passe', false)->assertSee('12 caractères minimum', false)
            ->assertSee('Application d&#039;authentification', false)->assertSee('setUpAppAuthentication', false);
    }

    public function test_password_change_requires_current_password_twelve_chars_and_confirmation(): void
    {
        $u = $this->user();
        $this->actingAs($u);
        $try = fn (array $d) => Livewire::test(EditProfile::class)->fillForm($d)->call('save');

        $try(['password' => 'nouveau-mot-de-passe-1', 'passwordConfirmation' => 'nouveau-mot-de-passe-1', 'currentPassword' => 'mauvais'])->assertHasFormErrors(['currentPassword']);
        $try(['password' => 'court-11car', 'passwordConfirmation' => 'court-11car', 'currentPassword' => self::OLD])->assertHasFormErrors(['password']);
        $try(['password' => 'nouveau-mot-de-passe-1', 'passwordConfirmation' => 'different-mot-de-passe', 'currentPassword' => self::OLD])->assertHasFormErrors(['password']);
        $try(['password' => 'nouveau-mot-de-passe-1', 'passwordConfirmation' => 'nouveau-mot-de-passe-1'])->assertHasFormErrors(['currentPassword']);
        $this->assertTrue(Hash::check(self::OLD, $u->fresh()->password), 'rejected attempts must not change the password');
    }

    public function test_valid_change_keeps_this_session_and_logs_out_the_others(): void
    {
        $u = $this->user();
        $u->forceFill(['remember_token' => 'ancien-jeton'])->save();
        $oldHash = $u->fresh()->password;
        $this->actingAs($u);
        session()->put('password_hash_web', $oldHash);
        $before = session()->getId();

        Livewire::test(EditProfile::class)
            ->fillForm(['password' => 'nouveau-mot-de-passe-1', 'passwordConfirmation' => 'nouveau-mot-de-passe-1', 'currentPassword' => self::OLD])
            ->call('save')->assertHasNoFormErrors();

        $fresh = $u->fresh();
        $this->assertTrue(Hash::check('nouveau-mot-de-passe-1', $fresh->password));
        $this->assertNotSame('ancien-jeton', $fresh->remember_token);
        $this->assertNotSame($before, session()->getId(), 'session id regenerated');
        $this->assertSame($fresh->password, session('password_hash_web'), 'current session follows the new password');

        // une autre session (empreinte de l'ancien mot de passe) est déconnectée par AuthenticateSession
        $this->flushSession();
        $this->actingAs($fresh)->withSession(['password_hash_web' => $oldHash])->get('/admin')->assertRedirect('/admin/login');
        $this->assertNull(\App\Models\AuditEntry::where('changes', 'like', '%nouveau-mot-de-passe%')->first());
    }

    public function test_two_factor_is_optional_and_enforced_only_once_enabled(): void
    {
        // sans 2FA : connexion directe
        $u = $this->user('sales_manager');
        Livewire::test(Login::class)->fillForm(['email' => $u->email, 'password' => self::OLD])->call('authenticate')->assertHasNoFormErrors();
        $this->assertAuthenticatedAs($u);
        auth()->logout();

        // 2FA activée par l'utilisateur : le mot de passe seul ne suffit plus, le code TOTP est exigé
        $mfa = Filament::getPanel('admin')->getMultiFactorAuthenticationProviders()['app'];
        $this->assertInstanceOf(AppAuthentication::class, $mfa);
        $this->assertTrue($mfa->isRecoverable());
        $secret = $mfa->generateSecret();
        $u->saveAppAuthenticationSecret($secret);
        $u->saveAppAuthenticationRecoveryCodes(array_map(fn ($c) => Hash::make($c), ['code-secours-1', 'code-secours-2']));
        $this->assertNotSame($secret, \DB::table('users')->where('id', $u->id)->value('app_authentication_secret'), 'secret stored encrypted');

        $login = Livewire::test(Login::class)->fillForm(['email' => $u->email, 'password' => self::OLD])->call('authenticate');
        $this->assertGuest();
        $login->set('data.multiFactor.app.code', '000000')->call('authenticate');
        $this->assertGuest();
        $login->set('data.multiFactor.app.code', $mfa->getCurrentCode($u))->call('authenticate');
        $this->assertAuthenticatedAs($u);
    }

    public function test_two_factor_recovery_code_logs_in_once(): void
    {
        $u = $this->user('sales_manager');
        $mfa = Filament::getPanel('admin')->getMultiFactorAuthenticationProviders()['app'];
        $u->saveAppAuthenticationSecret($mfa->generateSecret());
        $u->saveAppAuthenticationRecoveryCodes(array_map(fn ($c) => Hash::make($c), ['code-secours-1', 'code-secours-2']));

        Livewire::test(Login::class)->fillForm(['email' => $u->email, 'password' => self::OLD])->call('authenticate')
            ->set('data.multiFactor.app.useRecoveryCode', true)->set('data.multiFactor.app.recoveryCode', 'code-secours-1')->call('authenticate');
        $this->assertAuthenticatedAs($u);
        $this->assertCount(1, $u->fresh()->getAppAuthenticationRecoveryCodes());
    }
}
