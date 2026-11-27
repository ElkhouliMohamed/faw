<?php

namespace Tests\Feature;

use App\Filament\Resources\Notifications\Pages\EditNotifications;
use App\Models\AuditEntry;
use App\Models\SystemConfig;
use App\Models\User;
use App\Services\EmailSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_configuration_forms_are_real_and_secrets_are_write_only_and_encrypted(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $record = SystemConfig::where('name', 'notifications')->first();
        $record->saveForm(['resendKey' => 'synthetic-test-secret', 'emailFrom' => 'test@example.test']);
        $this->assertStringNotContainsString('synthetic-test-secret', DB::table('SystemConfig')->where('id', $record->id)->value('value'));
        $component = Livewire::test(EditNotifications::class)->assertDontSee('synthetic-test-secret');
        $this->assertEmpty($component->get('data.fields.resendKey'));
        $component->fillForm(['fields' => ['enabled' => false, 'transport' => 'resend', 'resendKey' => '', 'emailFrom' => 'new@example.test']])->call('save')->assertHasNoFormErrors();
        $this->assertEquals('synthetic-test-secret', $record->fresh()->value['resendKey']);
        $this->assertFalse(EmailSettings::ready());
        foreach (['themes', 'shopsettings', 'integrations', 'dynamics', 'aramex', 'cmi', 'notifications', 'socials', 'analyticsconnections', 'seosettings'] as $slug) {
            $this->get('/admin/'.$slug)->assertOk();
        }
        $this->getJson('/api/site-config')->assertOk()->assertDontSee('synthetic-test-secret')->assertDontSee('smtpPassword')->assertDontSee('emailFrom')->assertJsonPath('theme.accent', 'copper');
        $this->assertDatabaseHas((new AuditEntry)->getTable(), ['entity' => 'SystemConfig', 'action' => 'updated']);
    }

    public function test_card_and_external_connectors_cannot_be_enabled_by_tampering(): void
    {
        foreach (['cmi', 'aramex', 'dynamics', 'analytics_api'] as $name) {
            $record = SystemConfig::where('name', $name)->first();
            $record->saveForm(['enabled' => true]);
            $this->assertFalse($record->fresh()->value['enabled']);
        }
        $this->actingAs(User::factory()->create(['role' => 'viewer']));
        $this->get('/admin/notifications')->assertForbidden();
    }

    public function test_theme_marketing_and_seo_are_public_but_credentials_never_are(): void
    {
        SystemConfig::where('name', 'theme')->first()->saveForm(['mode' => 'dark', 'accent' => 'olive']);
        $this->assertFalse(SystemConfig::settings('shop')['showPrices'] ?? true);
        SystemConfig::where('name', 'integrations')->first()->saveForm(['gaEnabled' => true, 'gaId' => 'G-TEST1234', 'pixelEnabled' => true, 'pixelId' => '722847436891309']);
        SystemConfig::where('name', 'seo')->first()->saveForm(['noindex' => true, 'sitemapEnabled' => false]);
        SystemConfig::where('name', 'analytics_api')->first()->saveForm(['serviceAccountJson' => 'synthetic-private-json']);
        $this->getJson('/api/site-config')->assertOk()->assertJsonPath('theme.mode', 'dark')->assertJsonPath('shop.showPrices', false)->assertJsonPath('integrations.gaId', 'G-TEST1234')->assertJsonPath('integrations.pixelId', '722847436891309')->assertJsonPath('integrations.pixelEnabled', true)->assertJsonPath('seo.sitemapEnabled', false)->assertDontSee('synthetic-private-json');
        SystemConfig::where('name', 'integrations')->first()->saveForm(['pixelId' => 'not-a-pixel', 'gaId' => 'UA-123']);
        $this->getJson('/api/site-config')->assertOk()->assertJsonPath('integrations.pixelId', null)->assertJsonPath('integrations.gaId', null);
    }
}
