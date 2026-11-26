<?php

namespace App\Http\Controllers;

use App\Models\Attribute;
use App\Models\Product;
use App\Services\CommerceService;
use App\Services\PriceVisibility;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;

class CatalogPdfController extends Controller
{
    public function __invoke(CommerceService $commerce)
    {
        $attributes = Attribute::where('active', true)->where('showInSpecs', true)->get();
        $rows = [];
        $show = PriceVisibility::showOnSite();
        foreach (Product::where('active', true)->orderBy('category')->orderBy('sortOrder')->get() as $p) {
            $values = json_decode($p->attributes ?? '{}', true) ?: [];
            $specs = [];
            foreach ($attributes as $a) {
                if (isset($values[$a->key])) {
                    $specs[$a->label] = $values[$a->key].($a->unit ? ' '.$a->unit : '');
                }
            }
            $rows[] = ['id' => $p->id, 'title' => $p->title, 'category' => $p->category, 'price' => $show ? $commerce->productPrice($p)['price'] : 0, 'priceToConfirm' => $show ? $p->priceToConfirm : true, 'specs' => (object) $specs];
        }
        $tmp = tempnam(sys_get_temp_dir(), 'faw-catalog-');
        chmod($tmp, 0600);
        $out = $tmp.'.pdf';
        try {
            file_put_contents($tmp, json_encode($rows, JSON_UNESCAPED_UNICODE));
            $process = new Process([config('faw.python'), base_path('scripts/catalog_pdf.py'), $tmp, $out]);
            $process->setTimeout(30);
            try {
                $process->mustRun();
            } catch (ProcessFailedException|ProcessTimedOutException $e) {
                // Python or reportlab missing on this machine: answer 503 instead of a raw 500.
                report($e);

                return response()->json(['error' => 'Catalogue PDF momentanément indisponible.'], 503)->header('Cache-Control', 'no-store');
            }
            $bytes = file_get_contents($out);

            return response($bytes)->header('Content-Type', 'application/pdf')->header('Content-Disposition', 'attachment; filename="Catalogue-FAW.pdf"')->header('Cache-Control', 'no-store');
        } finally {
            if (is_file($tmp)) {
                unlink($tmp);
            }if (is_file($out)) {
                unlink($out);
            }
        }
    }
}
