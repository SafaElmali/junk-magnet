// Inline artwork is available before any models, textures or external images load.
export const loadingMarkup = `
<div class="loading-shell">
 <div class="loading-brand" aria-label="Junk Magnet">JUNK<span>MAGNET</span><i></i></div>
 <div class="loading-stage" aria-hidden="true"><svg viewBox="0 0 360 240" fill="none">
  <circle cx="180" cy="120" r="104" stroke="#486968" stroke-opacity=".4"/>
  <circle cx="180" cy="120" r="86" stroke="#709b89" stroke-opacity=".5" stroke-dasharray="3 12"/>
  <path d="M63 120h20m194 0h20M180 3v20m0 194v20" stroke="#c7b776" stroke-opacity=".55"/>
  <ellipse cx="180" cy="183" rx="47" ry="9" fill="#071f28" opacity=".5"/>
  <g class="loading-robot">
   <rect x="133" y="133" width="21" height="49" rx="8" fill="#102b33" stroke="#5c7c72" stroke-width="2"/>
   <rect x="206" y="133" width="21" height="49" rx="8" fill="#102b33" stroke="#5c7c72" stroke-width="2"/>
   <path d="M137 145h13m-13 11h13m-13 11h13m60-22h13m-13 11h13m-13 11h13" stroke="#819285" stroke-width="3"/>
   <rect x="149" y="101" width="62" height="75" rx="18" fill="#e8b74d" stroke="#f5d380" stroke-width="2"/>
   <path d="M156 80V51h14v29c0 15 20 15 20 0V51h14v29c0 35-48 35-48 0" fill="#d86148" stroke="#ec9870" stroke-width="2"/>
   <path d="M156 51h14v13h-14zm34 0h14v13h-14z" fill="#f7ebcd"/>
   <rect x="157" y="122" width="46" height="27" rx="12" fill="#173740"/>
   <g class="loading-eyes" fill="#a0e2da"><rect x="166" y="130" width="6" height="11" rx="3"/><rect x="187" y="130" width="6" height="11" rx="3"/></g>
   <path d="M171 161h18" stroke="#a97832" stroke-width="3" stroke-linecap="round"/>
  </g>
  <g class="loading-orbit">
   <g transform="translate(98 75) rotate(-22)"><path d="m0-11 10 5v12L0 12-10 6V-6Z" fill="#9eb9af" stroke="#d6e1c5" stroke-width="2"/><circle r="4" fill="#234950"/></g>
   <g transform="translate(263 163) rotate(25)"><path d="M-5-12h10v23H-5z" fill="#a0b8ac"/><path d="M-9-14H9v8H-9z" fill="#d3dfc3"/><path d="M-7 2H7M-7 7H7" stroke="#587a75" stroke-width="2"/></g>
   <g transform="translate(239 49)"><path d="m0-12 3 5 6-1-1 6 5 2-5 3 1 6-6-1-3 5-3-5-6 1 1-6-5-3 5-2-1-6 6 1Z" fill="#dfc17a" stroke="#f4dea1"/><circle r="4" fill="#305457"/></g>
   <path d="m122 192 7-7 7 7-7 7Z" fill="#5aafa7"/>
  </g>
 </svg></div>
 <div class="loading-copy"><span class="loading-eyebrow">THE SCRAPYARD</span><h2 id="load-title">Opening the yard…</h2><p id="load-detail">Unpacking the good junk.</p></div>
 <div class="loading-meter"><div class="loading-meter-label"><span>Loading progress</span><strong id="load-percent" aria-hidden="true">0%</strong></div><div class="load-track" id="load-meter" role="progressbar" aria-label="Loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="load-progress"></i></div></div>
 <p class="loading-tip">Keep moving. Your weapons fire automatically.</p>
 <button class="primary-btn hidden" id="reload">TRY AGAIN</button>
</div>`;
