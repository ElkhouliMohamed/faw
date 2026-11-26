<?php

namespace Tests\Unit;

use App\Support\DoorHeight;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DoorHeightTest extends TestCase
{
    #[DataProvider('texts')]
    public function test_it_reads_verified_height_and_invents_nothing(?string $text, ?string $expected): void
    {
        $this->assertSame($expected, DoorHeight::fromText($text));
    }

    public static function texts(): array
    {
        return [
            'details FAW' => ['Porte coupe-feu EI60 de 100 × 212,5 cm, 1 vantail, en acier galvanisé.', '212,5'],
            'point décimal' => ['Dimensions : 80 x 212.5 cm, 1 vantail.', '212,5'],
            'sans dimension' => ['Porte coupe-feu en acier galvanisé.', null],
            'vide' => [null, null],
        ];
    }
}
