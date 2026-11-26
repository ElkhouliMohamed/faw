<?php

namespace Tests\Concerns;

use App\Models\Quote;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

/** Accept the current version through the real portal API (code e-mailed to the faked Resend inbox). */
trait AcceptsQuotes
{
    protected function fakeResend(): void
    {
        $this->enableMail();
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'msg-test'], 200)]);
    }

    protected function acceptCurrent(Quote $q, string $rawToken): TestResponse
    {
        $v = $q->fresh()->currentVersion();
        $this->postJson('/api/portal/'.$rawToken.'/otp', ['versionId' => $v->id])->assertOk();

        return $this->postJson('/api/portal/'.$rawToken.'/accept', ['versionId' => $v->id, 'code' => $this->lastOtp(), 'confirm' => true], ['X-Faw-Client-Ip' => '41.250.10.20', 'X-Faw-Client-Ua' => 'PHPUnit']);
    }
}
