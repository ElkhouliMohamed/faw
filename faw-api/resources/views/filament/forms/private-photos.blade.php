<div class="flex flex-wrap gap-3">
@foreach(($getRecord()?->photos ?? []) as $index => $photo)
<a class="text-primary-600 underline" href="{{ url('/admin/attachments/'.$getRecord()->id.'/'.$index) }}" target="_blank" rel="noopener">Photo {{ $index + 1 }} (privée)</a>
@endforeach
</div>
