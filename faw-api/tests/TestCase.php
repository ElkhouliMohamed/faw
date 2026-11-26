<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Http;

abstract class TestCase extends BaseTestCase
{
    /** Real Meta Closer files that no test may ever touch (number counter and send journal). */
    private const REAL_FILES = ['/workspace/meta-closer/devis/compteur-devis.txt', '/workspace/meta-closer/devis/journal-devis.csv'];

    private array $realFingerprint = [];

    protected function setUp(): void
    {
        parent::setUp();
        // No real outbound HTTP from tests (Resend, analytics…): every call must be faked explicitly.
        Http::preventStrayRequests();
        $this->realFingerprint = self::fingerprint();
    }

    /** Safe defaults first, then trait hooks (e.g. QuoteSandbox) and each test may point to their own /tmp sandbox. */
    protected function setUpTraits()
    {
        // Default quote paths point nowhere: a test that needs the generator builds its own /tmp sandbox.
        config([
            'faw.generator' => '/tmp/faw-test-no-sandbox/generer_devis.py',
            'faw.counter' => '/tmp/faw-test-no-sandbox/prochain_numero.py',
            'faw.journal' => '/tmp/faw-test-no-sandbox/journal-devis.csv',
            'faw.output' => '/tmp/faw-test-no-sandbox/out',
            'faw.resend_key' => null,
            'faw.team_email' => 'delivered@resend.dev',
        ]);

        return parent::setUpTraits();
    }

    protected function tearDown(): void
    {
        $after = self::fingerprint();
        $before = $this->realFingerprint;
        parent::tearDown();
        if ($before !== $after) {
            throw new \RuntimeException('A test modified the real quote counter or journal in /workspace/meta-closer.');
        }
    }

    private static function fingerprint(): array
    {
        return array_map(fn ($f) => is_file($f) ? hash_file('sha256', $f).':'.filemtime($f) : 'absent', self::REAL_FILES);
    }
}
