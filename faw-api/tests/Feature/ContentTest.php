<?php

namespace Tests\Feature;

use App\Filament\Resources\ContentPages\Pages\ManageContentPages;
use App\Filament\Resources\Medias\Pages\ManageMedias;
use App\Filament\Resources\SavRequests\Pages\ManageSavRequests;
use App\Filament\Resources\Tickets\Pages\ManageTickets;
use App\Models\ContentPage;
use App\Models\InboxMessage;
use App\Models\Media;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class ContentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.debug' => true]);
    }

    public function test_real_cms_create_sanitizes_html_and_published_content_is_public(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        Livewire::test(ManageContentPages::class)->callAction('create', data: ['slug' => 'test-page', 'title' => 'Page de test', 'bodyHtml' => '<p onclick="bad()">Texte <strong>utile</strong></p><script>alert(1)</script><a href="javascript:bad()">Lien</a>', 'blocks' => [['type' => 'text', 'title' => 'Section test', 'body' => 'Texte de test.']], 'published' => true])->assertHasNoActionErrors();
        $p = ContentPage::first();
        $this->assertSame('page', $p->kind);
        $this->assertStringNotContainsString('script', $p->bodyHtml);
        $this->assertStringNotContainsString('onclick', $p->bodyHtml);
        $this->assertStringNotContainsString('javascript', $p->bodyHtml);
        $this->getJson('/api/content/page/test-page')->assertOk()->assertJsonPath('title', 'Page de test')->assertJsonPath('blocks.0.body', 'Texte de test.');
        $p->update(['published' => false]);
        $this->getJson('/api/content/page/test-page')->assertNotFound();
        $p->update(['published' => true, 'publishedAt' => now()->addDay()]);
        $this->getJson('/api/content/page/test-page')->assertNotFound();
    }

    public function test_empty_blog_and_new_cms_resources_render_without_seeded_articles(): void
    {
        $this->getJson('/api/blog')->assertOk()->assertJsonPath('total', 0);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        foreach (['/admin/contentpages', '/admin/technologies', '/admin/blogposts', '/admin/homepages', '/admin/blog-categories', '/admin/blog-tags', '/admin/team-inbox', '/admin/contacts', '/admin/tickets', '/admin/sav-requests', '/admin/medias'] as $path) {
            $this->get($path)->assertOk();
        }
    }

    public function test_sav_private_images_and_contact_assignment_are_real_and_do_not_send_messages(): void
    {
        Storage::fake('local');
        $payload = ['kind' => 'sav', 'name' => 'Client test', 'phone' => '0612345678', 'email' => 'test@example.test', 'subject' => 'Produit à examiner', 'message' => 'Description du problème.', 'photos' => [UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+M/9sAAAAASUVORK5CYII='))]];
        $this->post('/api/contacts', $payload, ['Accept' => 'application/json'])->assertCreated();
        $m = InboxMessage::first();
        Storage::disk('local')->assertExists($m->photos[0]);
        $this->get('/admin/attachments/'.$m->id.'/0')->assertRedirect('/admin/login');
        $admin = User::factory()->create(['role' => 'admin']);
        $this->actingAs($admin);
        $this->get('/admin/attachments/'.$m->id.'/0')->assertOk();
        Livewire::test(ManageSavRequests::class)->callAction(TestAction::make('edit')->table($m), data: ['status' => 'en cours', 'assignedTo' => $admin->id, 'notes' => 'Examen interne'])->assertHasNoActionErrors();
        $this->assertEquals('en cours', $m->fresh()->status);
        $this->post('/api/contacts', [...$payload, 'photos' => [UploadedFile::fake()->create('x.svg', 1, 'image/svg+xml')]], ['Accept' => 'application/json'])->assertUnprocessable();
    }

    public function test_owner_can_create_support_ticket_and_viewer_cannot(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        Livewire::test(ManageTickets::class)->callAction('create', data: ['kind' => 'ticket', 'name' => 'Client test', 'subject' => 'Assistance', 'message' => 'Question de test.', 'status' => 'nouveau', 'priority' => 'haute'])->assertHasNoActionErrors();
        $this->assertDatabaseHas('InboxMessage', ['kind' => 'ticket', 'priority' => 'haute']);
        $this->actingAs(User::factory()->create(['role' => 'viewer']));
        Livewire::test(ManageTickets::class)->assertActionHidden('create')->assertActionHidden(TestAction::make('edit')->table(InboxMessage::first()));
        $this->get('/admin/users')->assertForbidden();
    }

    public function test_media_upload_is_image_only_and_safe_name_is_public(): void
    {
        Storage::fake('public');
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        Livewire::test(ManageMedias::class)->callAction('create', data: ['file' => [UploadedFile::fake()->createWithContent('image.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+M/9sAAAAASUVORK5CYII='))], 'alt' => 'Image de test'])->assertHasNoActionErrors();
        $m = Media::first();
        $this->assertStringStartsWith('/storage/media/', $m->url);
        Livewire::test(ManageMedias::class)->assertTableColumnStateSet('preview', url($m->url), record: $m);
        Storage::disk('public')->assertExists($m->file);
        $m->delete();
        Storage::disk('public')->assertMissing($m->file);
    }
}
