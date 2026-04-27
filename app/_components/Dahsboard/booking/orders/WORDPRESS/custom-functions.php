<?php

add_action('init', function () {
    error_log('WP CUSTOM FUNCTIONS LOADED');
}, 1);

// === ORDER HISTORY SHORTCODE AND MODAL ===
if ( ! function_exists( 'power_get_order_modal_html' ) ) {
    /**
     * Returns the full HTML that load_order_details echoes.
     * No changes: same wrapper, same inline styles, same classes.x
     */
    function power_get_order_modal_html( int $post_id ): string {

        $fields = [
            'leveringsdato','pickup_address','extra_pickup_locations','delivery_address','total_km','tidsvindu_for_levering','bestillingsnr','beskrivelse',
            'kundens_navn','e-postadresse','telefon','etasje_nr','heis',
            'kasserers_navn','kasserers_telefon','driver','status','status_notes'
        ];

        ob_start();

  echo '<div class="order-detail-body" style="display:flex;gap:30px;flex-wrap:wrap;">';

        echo '<div class="order-detail-info" style="flex:1;">';

        $author_name = get_the_author_meta( 'display_name', get_post_field( 'post_author', $post_id ) );
    echo '<p><strong>Bestiller:</strong> ' . esc_html( $author_name ) . '</p>';

        foreach ( $fields as $field_name ) {
            $field = get_field_object( $field_name, $post_id );
            if ( ! $field ) { continue; }

            $val = $field['value'];
			
			
if ($field_name === 'tidsvindu_for_levering') {
    // Pull manual window (by key first, then by name)
    $fra = get_field('field_68c96a6e01ff4', $post_id);
    if ($fra === null) { $fra = get_field('endre_tid_fra', $post_id); }

    $til = get_field('field_68c96db7722ba', $post_id);
    if ($til === null) { $til = get_field('endre_tid_til', $post_id); }

    $fra = is_string($fra) ? trim($fra) : '';
    $til = is_string($til) ? trim($til) : '';

    $has_manual = ($fra !== '' && $til !== '' && $fra !== '00:00' && $til !== '00:00');

    if ($has_manual) {
        // Manual time always overrides—even if “Kontakt kunde”
        $val = $fra . ' - ' . $til;
    } else {
        // If no manual override and the value is empty or “Kontakt kunde”, show 6:00–6:05
        $is_kontakt = is_string($val) && strcasecmp(trim($val), 'Kontakt kunde') === 0;
        if ($val === '' || $is_kontakt) {
            $val = '6:00 - 6:05';
        }
    }
}





// Repeater
if ( $field_name === 'extra_pickup_locations' ) {
    $points = [];

   
    if ( ! empty( $val ) && is_array( $val ) ) {
        foreach ( $val as $row ) {
            $pickup = trim( $row['pickup'] ?? '' );
            if ( $pickup !== '' ) {
                $points[] = esc_html( $pickup );
            }
        }
    }

    if ( $points ) {
        echo '<p><strong>'.esc_html( $field['label'] ).':</strong> ' . implode( ', ', $points ) . '</p>';
    }
    continue;
}



            // Toggle
            if ( $field_name === 'heis' ) {
                if ( ! $val ) { continue; }
                $val = 'JA';
            }

            if ( is_array( $val ) ) { $val = implode( ', ', array_filter( $val ) ); }
			
			
if ( $val === '' ) { continue; }



            echo '<p><strong>'.esc_html( $field['label'] ).':</strong> '.esc_html( $val ).'</p>';
        }
 $published = get_the_date( 'd.m.Y', $post_id );
        echo '<p><strong>Bestillingsdato:</strong> '.esc_html( $published ).'</p>';
		// Hent sist redigert-dato og -tid
$mod_date = get_the_modified_date( 'd.m.Y', $post_id );


// Skriv det ut

        echo '</div>'; // .order-detail-info

        // price breakdown
        $use_subcontractor = !empty($_GET['subcontractor']);

        $breakdown = get_field( 'price_breakdown_html', $post_id );
     $breakdown = $use_subcontractor
  ? get_field('price_breakdown_subcontractor_html', $post_id)
  : get_field('price_breakdown_html', $post_id);
echo '<div class="order-detail-breakdown" style="flex:1;">' . $breakdown . '</div>';

	// --- FRONTEND ADMIN form at the bottom ---
$form_html = '';
if ( shortcode_exists( 'frontend_admin' ) ) {
    // Give the shortcode a sane global $post (some setups require this)
    $old_post = isset($GLOBALS['post']) ? $GLOBALS['post'] : null;
    $GLOBALS['post'] = get_post( $post_id );
    setup_postdata( $GLOBALS['post'] );

    $form_html = do_shortcode( '[frontend_admin form="7599" post_id="' . intval($post_id) . '"]' );

    wp_reset_postdata();
    if ( $old_post ) { $GLOBALS['post'] = $old_post; }
}

// Fallback: if the shortcode returned nothing (common when loaded via AJAX),
// render via a tiny iframe page that includes wp_head/wp_footer and the same shortcode.
if ( trim( wp_strip_all_tags( $form_html ) ) === '' ) {
    $form_url = add_query_arg(
        ['power-fea' => '1', 'post_id' => $post_id],
        home_url( '/' )
    );
    $form_html = '<iframe src="' . esc_url($form_url) . '" loading="lazy" ' .
                 'style="width:100%;min-height:720px;border:0;display:block;"></iframe>';
}

echo '<div class="order-detail-fea" style="flex:0 0 100%;width:100%;margin-top:10px;padding-top:12px;">'
   . $form_html .
   '</div>';



        echo '</div>'; // .order-detail-body

        return ob_get_clean();
    }
}

function render_order_table_for_user($atts) {
    $current_user_id = get_current_user_id();

    if (!empty($atts['user_id']) && current_user_can('manage_options')) {
        $current_user_id = intval($atts['user_id']);
    }

    ob_start();
	
// Needed so wp.media (file/image picker) works when form is injected via AJAX.
if ( function_exists( 'wp_enqueue_media' ) ) {
    wp_enqueue_media();
}

    $field_object = get_field_object('field_682dd6dba40f7');
    $status_choices = $field_object['choices'] ?? [];
	
    ?>

    <div class="order-wrapper">
		
    <form id="order-status-form" method="post"
  style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; align-items: end; margin-bottom: 30px; text-align: left;">

  <!-- Status -->
  <div>
    <label for="order_status">Status</label>
    <select name="order_status" id="order_status" style="width: 100%;">
      <option value="">Alle</option>
      <?php foreach ($status_choices as $value => $label): ?>
        <option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option>
      <?php endforeach; ?>
    </select>
  </div>

  <!-- Search -->
  <div>
    <label for="order_search_input">Søk</label>
    <input type="text" id="order_search_input" placeholder="Søk …" style="width: 100%;">
  </div>

  <!-- PDF download -->
  <div style="display: flex; gap: 10px; justify-self: start;">
    <button type="button" id="table-export-pdf-button"
      style="background: transparent; color: #2f2faa; border: 2px solid #2f2faa; padding: 8px 16px; border-radius: 6px; font-weight: 600;">
      Last ned tabell (PDF)
    </button>
  </div>

  <!-- Fra dato -->
  <div>
    <label for="date_from">Fra dato</label>
    <input type="date" name="date_from" id="date_from" style="width: 100%;">
  </div>

  <!-- Til dato -->
  <div>
    <label for="date_to">Til dato</label>
    <input type="date" name="date_to" id="date_to" style="width: 100%;">
  </div>

  <!-- Filter / Reset -->
  <div style="display: flex; gap: 10px;">
    <button type="submit"
      style="flex: 1; background: #2f2faa; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; font-weight: 600;">
      Filtrer
    </button>
    <button type="reset" id="order-reset-button"
      style="flex: 1; background: transparent; color: #999; border: 2px solid #999; padding: 8px 12px; border-radius: 6px; font-weight: 600;">
      Nullstill
    </button>
  </div>
</form>

    </div>

    <div id="order-table-wrapper"></div>

    <div id="order-modal" class="order-modal" style="display:none; max-width: 1200px; width: 90%; margin: auto;">
        <div class="order-modal-content" style="display: flex; gap: 30px; padding: 20px; background: #fff; border-radius: 8px; position: relative; box-shadow: 0 0 15px rgba(0,0,0,0.1);">
            <span class="modal-close-btn order-modal-close">&times;</span>
       <div id="order-modal-actions"
     style="position:absolute; top:10px; left:20px; z-index:10; display:flex; gap:10px; flex-wrap:wrap;">
  <button id="modal-export-pdf-button" class="order-export-button"
          style="padding:6px 14px; font-size:13px; background:transparent; color:#113357; border:2px solid #113357; border-radius:4px; cursor:pointer; transition:all .3s ease;">
    Last ned PDF
  </button>
  <button id="suggest-edits-button" class="order-export-button"
          style="padding:6px 14px; font-size:13px; background:transparent; color:#113357; border:2px solid #113357; border-radius:4px; cursor:pointer; transition:all .3s ease;">
    Endringer
  </button>
</div>

            <div id="order-modal-body" style="width: 100%; margin-top: 60px; display: flex; gap: 40px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;"></div>
        </div>
    </div>


<script>
(function () {
  function getOpenOrderModal() {
    const modals = document.querySelectorAll('.order-modal');
    for (const m of modals) {
      if (getComputedStyle(m).display !== 'none') return m;
    }
    return document.getElementById('order-modal') || null;
  }

  function closeAndReload() {
    const m = getOpenOrderModal();
    if (m) m.style.display = 'none';
    // Next animation frame → refresh the entire page
    requestAnimationFrame(() => location.reload());
  }

  // Make available to any code
  window.closeOrderModal = closeAndReload;

  // X button
  document.addEventListener('click', (e) => {
    if (e.target.closest('.order-modal-close')) {
      e.preventDefault();
      closeAndReload();
    }
  }, true);

  // Backdrop
  document.addEventListener('pointerdown', (e) => {
    const m = getOpenOrderModal();
    if (!m) return;
    const content = m.querySelector('.order-modal-content');
    if (e.target === m && !content.contains(e.target)) {
      e.preventDefault();
      closeAndReload();
    }
  }, true);

  // ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndReload();
    }
  });
})();
</script>
<script>
window.wireUpAttachmentsButton = function (modalBody) {
  const actions = document.getElementById('order-modal-actions');
  if (!actions || document.getElementById('attachments-button')) return;

  const feaWrap = modalBody.querySelector('.order-detail-fea');

  const btn = document.createElement('button');
  btn.id = 'attachments-button';
  btn.type = 'button';
  btn.textContent = 'Se vedlegg';

  const styleSrc = document.getElementById('modal-export-pdf-button');
  btn.className  = styleSrc?.className || 'order-export-button';
  btn.setAttribute(
    'style',
    styleSrc?.getAttribute('style') ||
    'padding:6px 14px; font-size:13px; background:transparent; color:#113357; border:2px solid #113357; border-radius:4px; cursor:pointer; transition:all .3s ease;'
  );

  async function waitFor(predicate, ms=1200, step=100){
    const start = Date.now();
    return new Promise(resolve=>{
      (function tick(){
        if (predicate()) return resolve(true);
        if (Date.now()-start >= ms) return resolve(false);
        setTimeout(tick, step);
      })();
    });
  }

  async function loadFallback(){
    const pid = window.__currentOrderId 
             || modalBody.closest('.order-modal')?.querySelector('[data-post-id]')?.getAttribute('data-post-id')
             || '';
    if (!pid) { alert('Fant ikke ordre-ID for vedlegg.'); return; }

    const containerId = 'attachments-fallback';
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.marginTop = '16px';
      container.innerHTML = '<div style="opacity:.7;font-size:13px">Laster vedlegg…</div>';
      if (feaWrap) {
        feaWrap.insertAdjacentElement('afterend', container);
      } else {
        modalBody.appendChild(container);
      }
    }

    const fd = new FormData();
    fd.append('action','otman_fetch_attachments');
    fd.append('post_id', String(pid));

    const html = await fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
      method:'POST', body: fd
    }).then(r=>r.text()).catch(()=>'<p>Kunne ikke hente vedlegg.</p>');

    container.innerHTML = html;
    container.scrollIntoView({ behavior:'smooth', block:'start' });
  }

btn.addEventListener('click', async () => {
  const pid = window.__currentOrderId 
           || modalBody.closest('.order-modal')?.querySelector('[data-post-id]')?.getAttribute('data-post-id')
           || '';
  if (!pid) { alert('Fant ikke ordre-ID for vedlegg.'); return; }

  const fd = new FormData();
  fd.append('action','otman_fetch_attachments');   // ✅ reuse your existing HTML endpoint
  fd.append('post_id', String(pid));

  try {
    const html = await fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
      method: 'POST',
      body: fd
    }).then(r => r.text());

    // Parse the HTML without rendering it
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tiles = Array.from(doc.querySelectorAll('.fea-uploads-attachment'));
    const items = tiles.map(t => ({
      url: t.getAttribute('data-href') || t.querySelector('a[href]')?.href || '',
      caption: t.getAttribute('data-name') || t.querySelector('.filename')?.textContent?.trim() || ''
    })).filter(i => i.url);

    if (!items.length) { alert('Ingen vedlegg funnet.'); return; }

    // Open lightbox directly at the first attachment — no right-side preview injected
    if (typeof window.otmanOpenAttachmentLightbox === 'function') {
      window.otmanOpenAttachmentLightbox(items, 0);
    } else {
      // ultra-fallback
      window.open(items[0].url, '_blank');
    }
  } catch (e) {
    alert('Kunne ikke hente vedlegg.');
  }
});


  actions.appendChild(btn);
};
</script>


<script>
document.addEventListener('DOMContentLoaded', function () {
  const suggestBtn = document.getElementById('suggest-edits-button');
  if (!suggestBtn) return;

  // We set the post ID when a row is clicked. If you don't store it, do so here:
  // In your existing code where you open the order modal, save a global:
  // window.__currentOrderId = postId;

  suggestBtn.addEventListener('click', function () {
    const postId = window.__currentOrderId 
                || document.querySelector('.order-row[data-post-id]')?.dataset.postId;
    if (!postId) {
      alert('Fant ikke Post ID for denne ordren.');
      return;
    }
    if (typeof window.openOtmanEditPopup === 'function') {
      window.openOtmanEditPopup(postId);
    } else {
      alert('Popup-modulen er ikke lastet.');
    }
  });
});



document.addEventListener('click', function (e) {
  const row = e.target.closest('.order-row');
  if (row) {
    window.__currentOrderId = row.getAttribute('data-post-id');
  }
});
</script>


<style>
	/* Match Forminator submit button to order-export-button */
#forminator-edit-form .forminator-button-submit {
  padding: 6px 14px;
  font-size: 13px;
  background: transparent;
  color: #113357;
  border: 2px solid #113357;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
}

/* Optional: hover effect */
#forminator-edit-form .forminator-button-submit:hover {
  background: #113357;
  color: white;
}
	#forminator-edit-form h3 {
  font-size: 13px;
  color: #113357;
  font-weight: 600;
  font-family: inherit !important;
  margin-bottom: 1em;
}

	

/* Put "Last ned tabell (PDF)" at the very bottom on mobile */
@media (max-width: 767px) {
  /* stack everything vertically */
  #order-status-form {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
  }

  /* full-width controls */
  #order-status-form > * { width: 100% !important; }

  /* move the PDF row to the bottom */
  #order-status-form > div:has(#table-export-pdf-button) {
    order: 999 !important;
  }

  /* make the button full width for nicer tap target */
  #table-export-pdf-button {
    width: 100% !important;
  }
}

	/* Hide the 'Bulk actions' dropdown rendered by Frontend Admin */
.fea-uploads-sort { 
  display: none !important;
}
/* Optional: also remove the <li> container spacing if needed */
.fea-uploads-sort { 
  position: absolute !important; width:0 !important; height:0 !important;
  padding:0 !important; margin:0 !important; border:0 !important; overflow:hidden !important;
}
</style>












    <style>
		/* Full-screen grey backdrop */
.order-modal{
    position:fixed;
    inset:0;                     /* top:0 right:0 bottom:0 left:0 */
    width:100vw;
    height:100vh;
    background:rgba(0,0,0,.6);
    display:none;                /* stays off until JS sets .style.display */
    align-items:center;
    justify-content:center;
    z-index:9999;
    overflow-y:auto;             /* if the dialog gets very tall */
}
/* keep your content box styling as it is */

    .price-breakdown-wrapper {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 60px;
    }
    .price-group {
        margin-bottom: 10px;
    }
    .price-group-label {
        font-weight: bold;
        margin-bottom: 6px;
    }
    .price-breakdown-row {
        display: flex;
        justify-content: space-between;
        border-bottom: 1px dotted #ccc;
        padding: 4px 0;
    }
    .price-breakdown-label {
        flex: 1;
    }
    .price-breakdown-price {
        text-align: right;
        font-weight: 500;
        min-width: 80px;
    }
    .price-summary {
        border-top: 2px solid #333;
        margin-top: 12px;
        padding-top: 8px;
    }
		
		
		
		
		/* Remove the faint top border inside the modal form */
#order-modal .order-detail-fea { border: 0 !important; }
		#order-modal .order-detail-fea { display: none !important; }
		#order-modal .order-detail-fea.order-detail-fea--visible { display: block !important; }

#order-modal .order-detail-fea .acf-fields > .acf-field:first-child { border-top: 0 !important; }
/* (if FEA outputs an <hr>) */
#order-modal .order-detail-fea hr { display: none !important; }

    </style>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script>
    document.addEventListener('DOMContentLoaded', function () {
        const select = document.getElementById('order_status');
		
		
function loadTable(filter = '', searchTerm = '', page = 1) {
    const formData = new FormData();
    formData.append('action', 'load_order_table');
    formData.append('order_status', filter);
    formData.append('order_search', searchTerm);
    formData.append('paged', page);
	  formData.append('date_from', document.getElementById('date_from')?.value || '');
  formData.append('date_to', document.getElementById('date_to')?.value || '');
					  formData.append('order_driver', document.getElementById('order_driver')?.value || '');
					   formData.append('order_subcontractor', document.getElementById('order_subcontractor')?.value || '');

					  
					  



    fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
        method: 'POST',
        body: formData
    })
    .then(res => res.text())
    .then(html => {
        document.getElementById('order-table-wrapper').innerHTML = html;

        // Add pagination link listeners
        document.querySelectorAll('.pagination-link').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const newPage = parseInt(this.getAttribute('data-page'));
                loadTable(filter, searchTerm, newPage);
            });
        });
    });
}



const searchInput = document.getElementById('order_search_input');
searchInput.addEventListener('input', function () {
    loadTable(select.value, searchInput.value.trim());
});

        
		select.addEventListener('change', () => loadTable(select.value, searchInput.value.trim(), 1));
searchInput.addEventListener('input', function () {
    loadTable(select.value, searchInput.value.trim(), 1);
});

        loadTable();
		
// Handle "Filtrer" button
document.getElementById('order-status-form').addEventListener('submit', function(e) {
  e.preventDefault();
  loadTable(
    document.getElementById('order_status')?.value || '',
    document.getElementById('order_search_input')?.value || '',
    1
  );
});

// Handle "Nullstill" button
document.getElementById('order-reset-button').addEventListener('click', function () {
  document.getElementById('order_status').value = '';
  document.getElementById('order_search_input').value = '';
  document.getElementById('date_from').value = '';
  document.getElementById('date_to').value = '';
  loadTable('', '', 1);
});


	  
	  
        document.addEventListener('click', function (e) {
            const row = e.target.closest('.order-row');
            if (!row) return;

            const postId = row.getAttribute('data-post-id');
            const modal = document.getElementById('order-modal');
            const modalBody = document.getElementById('order-modal-body');
            modal.style.display = 'flex';
            modalBody.innerHTML = 'Loading…';

            const formData = new FormData();
            formData.append('action', 'load_order_details');
            formData.append('post_id', postId);

            fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
                method: 'POST',
                body: formData
            })
            .then(res => res.text())
            .then(html => {
                modalBody.innerHTML = html;
	  try {
    if (window.acf && window.jQuery) {
      window.acf.doAction('append', window.jQuery(modalBody));
	


    }
  } catch (e) { console.warn('ACF append failed', e); }

  try {
    // Some setups expose FEA init methods; if present, run them.
    if (window.FEA && typeof window.FEA.initForms === 'function') {
      window.FEA.initForms();
    } else if (window.FEA && typeof window.FEA.init === 'function') {
      window.FEA.init();
    }
  } catch (e) { console.warn('FEA init failed', e); }
	  
	   window.wireUpAttachmentsButton?.(modalBody);
window.wireUpAttachmentsButton?.(document.getElementById('order-modal-body'));
	  
            });
        });

     

        async function safariPDFDownload(element, filename) {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF('p', 'pt', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 20, 20, pdfWidth - 40, pdfHeight);

            try {
                const blob = pdf.output('blob');
                const link = document.createElement('a');
                document.body.appendChild(link);

                if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
                    window.open(URL.createObjectURL(blob), '_blank');
                } else {
                    link.href = URL.createObjectURL(blob);
                    link.download = filename;
                    link.click();
                }
                document.body.removeChild(link);
            } catch (err) {
                console.error('PDF download failed:', err);
                alert('PDF download mislyktes. Vennligst prøv en annen nettleser eller last ned manuelt.');
            }
        }

        const pdfBtn = document.getElementById('modal-export-pdf-button');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', function (e) {
                e.preventDefault();
                const modalBody = document.querySelector('#order-modal-body');
                safariPDFDownload(modalBody, 'ordre-detaljer.pdf');
            });
        }

        const tableExportBtn = document.getElementById('table-export-pdf-button');
        if (tableExportBtn) {
            tableExportBtn.addEventListener('click', function (e) {
                e.preventDefault();
                const tableWrapper = document.getElementById('order-table-wrapper');
                safariPDFDownload(tableWrapper, 'ordre-tabell.pdf');
            });
        }
    });
    </script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  const body = document.getElementById('order-modal-body');
  if (!body) return;

  const ensureButton = () => {
    // Reuse your existing helper; it no-ops if the button already exists
    window.wireUpAttachmentsButton?.(body);
  };

  // If content is already there
  ensureButton();

  // Also when the summary HTML is injected/replaced
  new MutationObserver(ensureButton).observe(body, { childList: true, subtree: true });
});
</script>

<style id="fea-modal-attachment-lightbox">
  .attbox-backdrop{position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:32px}
  .attbox{position:relative;background:#0b0b0b;color:#fff;width:min(96vw,1200px);max-height:90vh;border-radius:12px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.5);display:flex;flex-direction:column}
  .attbox-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#111;border-bottom:1px solid rgba(255,255,255,.08)}
  .attbox-left,.attbox-right{display:flex;align-items:center;gap:8px}
  .attbox-caption{font-size:13px;opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52vw}
  .attbox-body{display:flex;align-items:center;justify-content:center;padding:12px}
  .attbox-img{max-width:100%;max-height:78vh;display:block}
  .attbox-iframe{width:min(96vw,1200px);height:78vh;border:0;background:#fff}
  .attbox-fallback{padding:30px;text-align:center;color:#ddd}

  /* ✅ Make ALL lightbox buttons match the white "Last ned" style */
  .attbox-btn{
    padding:6px 14px;font-size:13px;font-weight:600;line-height:1;
    border-radius:4px;border:2px solid #fff;background:transparent;color:#fff;
    display:inline-flex;align-items:center;gap:8px;cursor:pointer;text-decoration:none;
    transition:all .25s ease;
  }
  .attbox-btn:hover{background:#fff;color:#111}
  .attbox-btn[disabled]{opacity:.45;cursor:default}

  /* pointer cursor on tiles in order modal */
  #order-modal .fea-uploads-attachment,
  #order-modal .fea-uploads-attachment .thumbnail { cursor:pointer; }
</style>
<style>
  /* Force consistent white-outline style for all lightbox buttons */
  .attbox .attbox-btn,
  .attbox .attbox-btn:link,
  .attbox .attbox-btn:visited{
    -webkit-appearance: none;
    appearance: none;
    background: transparent !important;
    border: 2px solid #fff !important;
    color: #fff !important;
    padding: 6px 14px !important;
    font-size: 13px !important;
    line-height: 1 !important;
    font-weight: 600 !important;
    border-radius: 4px !important;
    text-decoration: none !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    box-shadow: none !important;
    cursor: pointer !important;
    transition: all .25s ease !important;
  }
  .attbox .attbox-btn:hover{
    background:#fff !important;
    color:#111 !important;
  }
  .attbox .attbox-btn:active{
    transform: translateY(0.5px);
  }
  .attbox .attbox-btn[disabled],
  .attbox .attbox-btn:disabled{
    opacity:.45 !important;
    cursor: default !important;
    background: transparent !important;
    color:#fff !important;
    border-color:#fff !important;
  }
</style>


<script>
(function(){
  if (window.__feaModalAttboxInstalled) return; window.__feaModalAttboxInstalled = true;

  const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
  const PDF_RE = /\.pdf(\?|#|$)/i;

  const isImage = (u)=>IMG_RE.test(u||'');
  const isPdf   = (u)=>PDF_RE.test(u||'');

  function filenameFromUrl(url){
    try{
      const path = url.split('?')[0].split('#')[0];
      return decodeURIComponent(path.substring(path.lastIndexOf('/')+1)) || 'download';
    }catch(e){ return 'download'; }
  }

  function collectGallery(startEl){
    const scope = startEl.closest('.fea-uploads, .fea-field, .acf-field, #order-modal-body') || document;
    const items = Array.from(scope.querySelectorAll('.fea-uploads-attachment'))
      .map(item=>{
        const url = item.getAttribute('data-href')
                  || item.dataset?.href
                  || item.querySelector('a[href]')?.href
                  || '';
        const caption = item.getAttribute('data-name')
                       || item.querySelector('.filename')?.textContent?.trim()
                       || item.querySelector('img[alt]')?.alt
                       || filenameFromUrl(url);
        return url ? { el:item, url, caption } : null;
      })
      .filter(Boolean);
    const clicked = startEl.closest('.fea-uploads-attachment');
    const idx = Math.max(0, items.findIndex(x => x.el === clicked || x.el.contains(startEl)));
    return { items, idx };
  }

  function renderLightbox(items, startIndex){
    let index = startIndex;

    const backdrop = document.createElement('div');
    backdrop.className = 'attbox-backdrop';
    backdrop.tabIndex = -1;

    const box = document.createElement('div');
    box.className = 'attbox';

    // Toolbar
    const toolbar = document.createElement('div'); toolbar.className = 'attbox-toolbar';
    const left = document.createElement('div'); left.className = 'attbox-left';
    const right = document.createElement('div'); right.className = 'attbox-right';

    const btnPrev = document.createElement('button'); btnPrev.type='button'; btnPrev.textContent='‹ Forrige'; btnPrev.className='attbox-btn';
    const caption = document.createElement('div'); caption.className='attbox-caption';
    const btnNext = document.createElement('button'); btnNext.type='button'; btnNext.textContent='Neste ›'; btnNext.className='attbox-btn';

    const aDown = document.createElement('a'); aDown.textContent='Last ned'; aDown.className='attbox-btn'; aDown.setAttribute('download','');
    const btnClose = document.createElement('button'); btnClose.type='button'; btnClose.textContent='Lukk (Esc)'; btnClose.className='attbox-btn';

    left.append(btnPrev, caption, btnNext);
    right.append(aDown, btnClose);
    toolbar.append(left, right);

    // Body
    const body = document.createElement('div'); body.className='attbox-body';

    box.append(toolbar, body);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);

    function destroy(){
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
    }
    function onKey(e){
      if (e.key==='Escape'){ e.preventDefault(); destroy(); }
      if (e.key==='ArrowLeft'){ e.preventDefault(); go(-1); }
      if (e.key==='ArrowRight'){ e.preventDefault(); go(+1); }
    }
    function go(step){
      const newIndex = index + step;
      if (newIndex<0 || newIndex>=items.length) return;
      index = newIndex; show();
    }
    btnPrev.onclick = ()=>go(-1);
    btnNext.onclick = ()=>go(+1);
    btnClose.onclick = destroy;
    backdrop.addEventListener('click', (e)=>{ if (e.target === backdrop) destroy(); });
    document.addEventListener('keydown', onKey, true);

    function show(){
      const it = items[index];
      btnPrev.disabled = (index===0);
      btnNext.disabled = (index===items.length-1);
      caption.textContent = it.caption || filenameFromUrl(it.url);

      // Download only (no "open in new tab")
      aDown.href = it.url;
      aDown.setAttribute('download', filenameFromUrl(it.url));

      body.innerHTML = '';
      if (isImage(it.url)) {
        const img = new Image(); img.className='attbox-img'; img.alt = it.caption || '';
        img.src = it.url; body.appendChild(img);
      } else if (isPdf(it.url)) {
        const ifr = document.createElement('iframe'); ifr.className='attbox-iframe'; ifr.src = it.url; ifr.allow = 'fullscreen';
        body.appendChild(ifr);
      } else {
        const div = document.createElement('div'); div.className='attbox-fallback';
        div.innerHTML = '<p>Forhåndsvisning er ikke tilgjengelig for denne filtypen. Du kan laste ned filen.</p>';
        body.appendChild(div);
      }
    }

    show();
    setTimeout(()=>backdrop.focus(), 0);
  }

window.otmanOpenAttachmentLightbox = function(items, startIndex = 0){
  if (!Array.isArray(items) || !items.length) {
    alert('Ingen vedlegg funnet.');
    return;
  }
  const mapped = items.map(i => ({ el:null, url:i.url, caption:i.caption || '' }));
  renderLightbox(mapped, Math.max(0, startIndex|0));
};

  // Only inside your order modal
  document.addEventListener('click', function(e){
    const modal = document.getElementById('order-modal');
    if (!modal || getComputedStyle(modal).display === 'none') return;
    const tile = e.target.closest('.fea-uploads-attachment');
    if (!tile) return;

    // Use our lightbox (no "åpne i ny fane")
    const href = tile.getAttribute('data-href') || tile.dataset?.href || tile.querySelector('a[href]')?.href;
    if (!href) return;
    e.preventDefault(); e.stopPropagation();

    const { items, idx } = collectGallery(tile);
    if (!items.length) return;
    renderLightbox(items, Math.max(0, idx));
  }, true);

  // Keep pointer cursor on dynamic tiles inside the modal
  const mo = new MutationObserver(() => {
    const modal = document.getElementById('order-modal');
    if (!modal) return;
    modal.querySelectorAll('.fea-uploads-attachment, .fea-uploads-attachment .thumbnail')
      .forEach(el => { el.style.cursor='pointer'; });
  });
  mo.observe(document.documentElement, { childList:true, subtree:true });
})();
</script>




    <?php
	// Hidden primer so FEA/ACF enqueue their JS/CSS during initial page load.
echo '<div style="display:none">'
   . do_shortcode( '[frontend_admin form="7599" post_id="0"]' )
   . '</div>';

    return ob_get_clean();
}
// add_shortcode('order_history_table', 'render_order_table_for_user');
add_shortcode('order_history_table', function ($atts = []) {
    $table_html = render_order_table_for_user($atts);
    $popup_html = do_shortcode('[otman_edit_request_popup]');
    return $table_html . $popup_html;
});




// === ONE, GLOBAL, AGGRESSIVE WIPE ===
if (!function_exists('otman_gdpr_wipe_raw')) {
  function otman_gdpr_wipe_raw(int $post_id): void {
    if ($post_id <= 0 || get_post_type($post_id) !== 'power_order') return;

    global $wpdb;

    // All meta keys to nuke (names exactly as used in your renderers)
    $PII_KEYS = [
      'kundens_navn','e-postadresse','telefon','telefon_full',
      'kasserers_telefon','kasserers_telefon_full',
      'pickup_address','delivery_address','returadresse',
      'contact_notes','info_til_sjaforen','ekstra_kundens_telefon',
      'extra_pickup_locations', // parent
    ];

    // 1) Hard delete main key and its ACF underscore meta
    foreach ($PII_KEYS as $k) {
      delete_post_meta($post_id, $k);
      delete_post_meta($post_id, '_'.$k);
      // also normalize to truly empty for templates that expect the meta to exist
      update_post_meta($post_id, $k, '');
    }

    // 2) Hard delete any repeater/subfield rows for extra_pickup_locations (any index / any column)
    $wpdb->query(
      $wpdb->prepare(
        "DELETE FROM {$wpdb->postmeta}
         WHERE post_id = %d
           AND ( meta_key = %s
                 OR meta_key LIKE %s )",
        $post_id,
        'extra_pickup_locations',
        $wpdb->esc_like('extra_pickup_locations_') . '%'
      )
    );

    // 3) Super-nuke: if any custom “_full”/formatted variants slipped through
    $wpdb->query(
      $wpdb->prepare(
        "DELETE FROM {$wpdb->postmeta}
         WHERE post_id = %d
           AND ( meta_key LIKE %s OR meta_key LIKE %s )",
        $post_id,
        $wpdb->esc_like('telefon%'),
        $wpdb->esc_like('kasserers_telefon%')
      )
    );

    // 4) Clear all caches so get_field() can’t serve stale values
    clean_post_cache($post_id);
    wp_cache_delete($post_id, 'post_meta');

    if (function_exists('acf_flush_value_cache')) {
      // ACF 6+: clear the local value cache for this post
      acf_flush_value_cache($post_id);
    }
    // Clear ACF reference caches (safe even if not present)
    if (function_exists('acf_delete_metadata')) {
      foreach ($PII_KEYS as $k) {
        acf_delete_metadata($post_id, $k);
      }
    }

    update_post_meta($post_id, '_gdpr_erased_on_paid', current_time('mysql'));
    if (is_user_logged_in()) update_post_meta($post_id, '_gdpr_erased_by', get_current_user_id());
  }
}





add_action( 'wp_ajax_load_order_details', function () {
    $post_id = intval( $_REQUEST['post_id'] ?? 0 );
    if ( ! $post_id ) { wp_die( 'Invalid ID' ); }

    echo power_get_order_modal_html( $post_id );   // identical HTML
    wp_die();
} );



add_action('wp_ajax_load_order_table', 'ajax_render_order_table');
add_action('wp_ajax_nopriv_load_order_table', 'ajax_render_order_table');
function ajax_render_order_table() {
    $current_user_id = get_current_user_id();
   $selected_status = sanitize_text_field($_POST['order_status'] ?? '');
$search_term = sanitize_text_field($_POST['order_search'] ?? '');
$date_from = sanitize_text_field($_POST['date_from'] ?? '');
$date_to   = sanitize_text_field($_POST['date_to'] ?? '');


    $meta_query = [];
	if ($date_from || $date_to) {
  $meta_query[] = [
    'key'     => 'leveringsdato',
    'value'   => array_filter([$date_from, $date_to]),
    'compare' => 'BETWEEN',
    'type'    => 'DATE'
  ];
}
    if (!empty($selected_status)) {
		

     $meta_query[] = ['key'=>'status','value'=>$selected_status,'compare'=>'='];

    }
  // 2) Global search across multiple meta fields
    if ( $search_term !== '' ) {
        $fields = [
            'bestillingsnr',
            'kundens_navn',
            'telefon',
            'leveringsdato',
            'total_price',
			'driver',
			'subcontractor',
        ];

        // wrap all field‐checks in a single OR clause
        $search_clauses = [ 'relation' => 'OR' ];
        foreach ( $fields as $field_key ) {
            $search_clauses[] = [
                'key'     => $field_key,
                'value'   => $search_term,
                'compare' => 'LIKE',
            ];
        }

        $meta_query[] = $search_clauses;
    }
$paged = isset($_POST['paged']) ? max(1, intval($_POST['paged'])) : 1;
$args = [
    'post_type'      => 'power_order',
    'posts_per_page' => 50,
    'paged'          => $paged,
    'post_status'    => 'publish',
    'author'         => $current_user_id,
    'meta_query'     => $meta_query,
    'meta_key'       => 'leveringsdato',
    'orderby'        => 'meta_value',
    'meta_type'      => 'DATE',
    'order'          => 'DESC',
];

    $query = new WP_Query($args);
    echo '<table class="order-history-table" id="orderTable">';
    echo '<thead><tr><th>Status</th><th>Status notater</th><th>Bestillings nr</th><th>Kundens navn</th><th>Kundens telefon</th><th>Leveringsdato</th><th>Pris uten MVA</th></tr></thead><tbody>';

    while ($query->have_posts()) : $query->the_post();
        $post_id = get_the_ID();

        $field_object = get_field_object('field_682dd6dba40f7', $post_id);
        $value = get_field('field_682dd6dba40f7', $post_id) ?: 'Behandles';
        $label = $field_object['choices'][$value] ?? $value;
        $css_class = 'status-' . sanitize_title(strtolower($value));
        $status_output = '<span class="order-status ' . esc_attr($css_class) . '"><span class="status-dot"></span><span class="order-status-text">' . esc_html($label) . '</span></span>';

        $order_nr = get_field('bestillingsnr', $post_id);
	$leveringsdato = get_field('leveringsdato', $post_id);
        $amount = get_field('total_price', $post_id);
        if (!$amount) $amount = 0;

        $customer_name = get_field('kundens_navn', $post_id);
	$status_notes = get_field('status_notes', $post_id);
	

 	$customer_telefon = get_field('telefon_full', $post_id) ?: get_field('telefon', $post_id);
	
        if (!$customer_name) $customer_name = 'Ukjent';

        $date = get_the_date('d.m.Y');

        echo '<tr class="order-row" data-post-id="' . esc_attr($post_id) . '">';
        echo '<td>' . $status_output . '</td>';
	 echo '<td>' . esc_html($status_notes) . '</td>';
        echo '<td><strong>' . esc_html($order_nr) . '</strong></td>';
        echo '<td>' . esc_html($customer_name) . '</td>';
	echo '<td>' . esc_html($customer_telefon) . '</td>';
	
        echo '<td>' . esc_html($leveringsdato) . '</td>';
        echo '<td>NOK ' . number_format((float) $amount, 0, ',', ' ') . '</td>';
        echo '</tr>';
    endwhile;

    echo '</tbody></table>';
	echo '</tbody></table>';

// Add pagination
$total_pages = $query->max_num_pages;
	function paginationButtonStyle($active) {
    $primary = '#2f2faa';
    $bg = $active ? $primary : '#ffffff';
    $color = $active ? '#ffffff' : $primary;
    return "padding: 6px 12px; border: 2px solid $primary; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; background-color: $bg; color: $color; transition: all 0.3s ease;";
}

if ($total_pages > 1) {
    echo '<div class="pagination" style="margin-top: 20px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">';

    // First page button
    if ($paged > 1) {
        echo '<a href="#" class="pagination-link" data-page="1" style="' . paginationButtonStyle(false) . '">«</a>';
    }

    // Previous page
    if ($paged > 1) {
        $prev_page = $paged - 1;
        echo '<a href="#" class="pagination-link" data-page="' . $prev_page . '" style="' . paginationButtonStyle(false) . '">←</a>';
    }

    // Dynamic page range (max 3 pages)
   $range = 4; // Half of max (8 total)
$start = max(1, $paged - $range);
$end = min($total_pages, $paged + $range - 1);

if ($end - $start + 1 > 8) {
    $end = $start + 7;
    if ($end > $total_pages) {
        $end = $total_pages;
        $start = max(1, $end - 7);
    }
}


    for ($i = $start; $i <= $end; $i++) {
        $is_active = ($i === $paged);
        echo '<a href="#" class="pagination-link" data-page="' . $i . '" style="' . paginationButtonStyle($is_active) . '">' . $i . '</a>';
    }

    // Next page
    if ($paged < $total_pages) {
        $next_page = $paged + 1;
        echo '<a href="#" class="pagination-link" data-page="' . $next_page . '" style="' . paginationButtonStyle(false) . '">→</a>';
    }

    // Last page button
    if ($paged < $total_pages) {
        echo '<a href="#" class="pagination-link" data-page="' . $total_pages . '" style="' . paginationButtonStyle(false) . '">»</a>';
    }

    echo '</div>';
}


    wp_reset_postdata();
    wp_die();
}


function otman_sidebar_shortcode() {
    return otman_render_sidebar([
        ['link' => '/powerorder', 'label' => 'Bestilling', 'svg' => 'box'],
        ['link' => '/power-order-history', 'label' => 'Bestillingshistorikk', 'svg' => 'lines'],
    ]);
}

function order_sidebar_shortcode() {
    return otman_render_sidebar([
        ['link' => '/order', 'label' => 'Bestilling', 'svg' => 'box'],
        ['link' => '/order-history', 'label' => 'Bestillingshistorikk', 'svg' => 'lines'],
    ]);
}

function subcontractor_sidebar_shortcode() {
    return otman_render_sidebar([
       
        ['link' => '/kurjer-delivery-history', 'label' => 'Bestillingshistorikk', 'svg' => 'lines'],
    ]);
}

function davis_sidebar_shortcode() {
    return otman_render_sidebar([
        ['link' => '/order-main-page', 'label' => 'All orders', 'svg' => 'box'],
        ['link' => '/powerotman', 'label' => 'Create new order', 'svg' => 'notepad'],
		['link' => '/powerorder2', 'label' => 'Create Power order', 'svg' => 'notepad'],
    ]);
}

function otman_render_sidebar(array $items): string {
    $logout_url = esc_url(wp_logout_url(home_url('/client-login')));

    ob_start(); ?>
    <button id="sidebar-toggle" class="sidebar-toggle" aria-label="Toggle menu">&#9776;</button>
    <div id="sidebar-menu" class="sidebar">
		
<?php echo do_shortcode('[current_user_name class="sidebar-username sidebar-username--mobile" style="display:none"]'); ?>


		
        <?php foreach ($items as $item): 
            $slug = trim(parse_url($item['link'], PHP_URL_PATH), '/');
        ?>
            <a href="<?php echo esc_url($item['link']); ?>" class="sidebar-button" data-page="<?php echo esc_attr($slug); ?>">
                <?php echo otman_get_svg($item['svg']); ?>
                <span><?php echo esc_html($item['label']); ?></span>
            </a>
        <?php endforeach; ?>
        <a href="<?php echo $logout_url; ?>" class="sidebar-button" data-page="logout">
            <?php echo otman_get_svg('logout'); ?>
            <span>Logg ut</span>
        </a>
    </div>

    <?php
    return ob_get_clean();
}


	
function otman_get_svg(string $type): string {
    switch ($type) {
   case 'box':
    return '
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
        <path d="M21 16V8a1 1 0 0 0-.553-.894l-8-4a1 1 0 0 0-.894 0l-8 4A1 1 0 0 0 3 8v8a1 1 0 0 0 .553.894l8 4a1 1 0 0 0 .894 0l8-4A1 1 0 0 0 21 16zM12 3.236L19.764 7 12 10.764 4.236 7 12 3.236zM5 8.618l7 3.5v7.764l-7-3.5V8.618zM12 19.882v-7.764l7-3.5v7.764l-7 3.5z"/>
    </svg>';

        
        case 'lines': // Matches Bestillingshistorikk
            return '
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
            </svg>';

      case 'notepad': // Matches Create new order
            return '
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
              <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.828a2 2 0 0 0-.586-1.414l-4.828-4.828A2 2 0 0 0 13.172 1H6zm6 1.414L18.586 8H14a2 2 0 0 1-2-2V3.414zM8 13h8v2H8v-2zm0 4h8v2H8v-2z"/>
            </svg>';
			
        case 'logout': // Matches Logg ut
            return '
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="24" height="24" viewBox="0 0 24 24">
              <path d="M16 13v-2H7V8l-5 4 5 4v-3h9zm3-10H5c-1.1 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
            </svg>';

        default:
            return '';
    }
}


// ✅ Register the shortcodes
add_shortcode('otman_sidebar', 'otman_sidebar_shortcode');
add_shortcode('davis_sidebar', 'davis_sidebar_shortcode');
add_shortcode('order_sidebar', 'order_sidebar_shortcode');
add_shortcode('subcontractor_sidebar', 'subcontractor_sidebar_shortcode');


// === ADMIN ORDER TABLE SHORTCODE WITH IFRAME MODAL VIEW (WORKS IN CHROME) ===

add_shortcode('admin_order_table', 'render_admin_order_table');
function render_admin_order_table() {
    ob_start();


    // — Fetch filter data
    $field_object   = get_field_object('field_682dd6dba40f7');
    $status_choices = $field_object['choices'] ?? [];
    $subcontractor_usernames = [
    'Bahs Kurjer',
    'Nordline AS',
    'Tastanovas Matbutikk',
    'Viken Travsport Tanha',
    'Arnosan AS',
    'Ievitis Transport',
    'Stombergas Transport',
    'New subcontractor 1',
    'New subcontractor 2',
    'Bygg Service Vaicuss',
    'Linebox',
    'Christiania flytt og vask AS',
    'Albittar Transport AS',
];

$exclude_ids = [];
foreach ($subcontractor_usernames as $username) {
    $user = get_user_by('login', $username);
    if ($user) {
        $exclude_ids[] = (int) $user->ID;
    }
}

$authors = get_users([
    'orderby' => 'display_name',
    'order'   => 'ASC',
    'exclude' => $exclude_ids,
]);

		$field_object_subcontractor = get_field_object('field_6902089488faf');
$subcontractor_choices = $field_object_subcontractor['choices'] ?? [];
    ?>

    <!-- FILTER FORM -->
    <form id="admin-order-filter-form" method="post"
          style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;align-items:end;margin-bottom:20px">
    <div style="display: flex; gap: 10px;align-items:center;width:100%;">
		<!-- Status -->
      <div style="width:100%;">
        <label for="order_status">Status</label>
        <select name="order_status" id="order_status">
          <option value="">Alle statuser</option>
          <?php foreach ($status_choices as $value => $label): ?>
            <option value="<?php echo esc_attr($value) ?>"><?php echo esc_html($label) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <!-- Customer -->
      <div  style="width:100%;">
        <label for="order_author">Kunde</label>
        <select name="order_author" id="order_author">
          <option value="">Alle kunder</option>
          <?php foreach ($authors as $author): ?>
            <option value="<?php echo esc_attr($author->ID) ?>"><?php echo esc_html($author->display_name) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
		 </div>
	
		<!-- Driver filter -->
<!-- <div>
  <label for="order_driver">Driver</label>
  <select name="order_driver" id="order_driver" style="width: 100%;">
    <option value="">All drivers</option>
    <?php foreach ($driver_choices as $value => $label): ?>
      <option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option>
    <?php endforeach; ?>
  </select>
</div> -->
		
			<!-- Subcontractor filter -->
		  <div style="display: flex; gap: 10px;align-items:center;width:100%;">
		<!-- Status -->
    	
<div style="width:50%;">
  <label for="order_subcontractor">Subcontractor</label>
  <select name="order_subcontractor" id="order_subcontractor" style="width: 100%;">
    <option value="">All subcontractors</option>
    <?php foreach ($subcontractor_choices as $value => $label): ?>
      <option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option>
    <?php endforeach; ?>
  </select>
</div>	
</div>	
  <div style="display: flex; gap: 10px;align-items:center;width:100%;">
	</div>	 	
	<div style="display: flex; gap: 10px;align-items:center;width:100%;">

		 <!-- Date From -->
      <div style="width:100%;">
        <label for="date_from">Fra dato</label>
        <input type="date" name="date_from" id="date_from" >
      </div>	
		
	
		


   <!-- Date To -->
      <div style="width:100%;">
        <label for="date_to">Til dato</label>
        <input type="date" name="date_to" id="date_to" >
      </div>
		
     </div>
		

		
		<!-- Quick Date Filters -->
<div style="display: flex; width:50%; gap: 10px;">
  <button type="button" class="quick-date-btn" data-days="0"
    style="background:#2f2faa;color:#fff;border:none;padding:6px 12px;border-radius:6px;width:50%;font-weight:600">
    I dag
  </button>
  <button type="button" class="quick-date-btn" data-days="1"
    style="background:#2f2faa;color:#fff;border:none;padding:6px 12px;border-radius:6px;width:50%;font-weight:600">
    I morgen
  </button>
</div>		
		
		<div style="display: flex; gap: 10px;">
		</div>	
		
		
<div style="display:flex; gap:10px; align-items:center;">
  <input
    type="text"
    id="slug_id_search"
    name="slug_id_search"
    placeholder="Søk ID"
    style="width:9ch;"
  >
  <input
    type="text"
    name="order_search"
    id="order_search"
    placeholder="Søk …"
    style="flex:1; min-width:0;"
  >
</div>
   


      <!-- Filter / Reset / Exports -->
      <div style="display:flex;width:50%;gap:10px">
        <button type="submit" id="order-filter-button"
                 style="background:#2f2faa;color:#fff;border:none;padding:6px 12px;width:50%;border-radius:6px;font-weight:600">
          Filtrer
        </button>
        <button type="reset" id="order-reset-button"
                 style="background:transparent;color:#999;border: 2px solid #999;width:50%;padding:6px 12px;border-radius:6px;font-weight:600">
          Nullstill
        </button>
      </div>
		
    <div style="grid-row;justify-self:start">
        <button type="button" id="download_pdf"
                style="background:transparent;color:#2f2faa;border:2px solid #2f2faa;padding:8px 16px;border-radius:6px;font-weight:600;display:none">
          Last ned PDF
        </button>
     
		

      </div>
<!-- Posts Per Page -->
<div>
  <label for="posts_per_page">Antall bestillinger per side</label>
  <input type="number" name="posts_per_page" id="posts_per_page" min="1" step="1" value="100" style="width: 100%;">
</div>		
				
		
    </form>

<!-- BULK STATUS ACTIONS -->
<div id="bulk-status-controls"
     style="margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
  <select id="bulk-status-select"
    style="width:30ch; min-width:12ch; box-sizing:border-box;
           padding:4px 8px; font-size:14px; border:1px solid #ccc; border-radius:4px;">
    <option value="" title="Endre status for valgte:">Endre status for valgte:</option>
    <?php foreach ($status_choices as $val => $label): ?>
      <option value="<?php echo esc_attr($val); ?>"><?php echo esc_html($label); ?></option>
    <?php endforeach; ?>
  </select>

  <button type="button" id="bulk-status-apply"
    style="padding:6px 10px; font-size:14px; background:#2f2faa; color:#fff; border:0; border-radius:4px; font-weight:600;">
    Oppdater status
  </button>
</div>




<!-- BULK SUBCONTRACTOR ACTIONS -->
<div id="bulk-subcontractor-controls"
     style="margin-bottom:14px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
  <select id="bulk-subcontractor-select"
 style="width:30ch; min-width:12ch; box-sizing:border-box;
           padding:4px 8px; font-size:14px; border:1px solid #ccc; border-radius:4px;">
    <option value="" title="Endre subcontractor for valgte:">Endre subcontractor for valgte:</option>
    <?php foreach ($subcontractor_choices as $value => $label): ?>
      <option value="<?php echo esc_attr($value); ?>"><?php echo esc_html($label); ?></option>
    <?php endforeach; ?>
  </select>
	

	
  <button type="button" id="bulk-subcontractor-apply"
    style="padding:6px 10px; font-size:14px; background:#2f2faa; color:#fff; border:0; border-radius:4px; font-weight:600;">
    Oppdater subcontractor
  </button>
</div>



<!-- BULK DRIVER ACTIONS -->
<!-- BULK DRIVER (FREE-TEXT) -->
<div id="bulk-driver-text-controls"
     style="margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
  <input type="text" id="bulk-driver-text" placeholder="Skriv sjåførnavn …"
         style="width:30ch; min-width:12ch; box-sizing:border-box; padding:6px 10px; font-size:14px; border:1px solid #ccc; border-radius:6px;">
  <button type="button" id="bulk-driver-text-apply"
          style="padding:6px 10px; font-size:14px; background:#2f2faa; color:#fff; border:0; border-radius:4px; font-weight:600;">
    Oppdater sjåfør (fri tekst)
  </button>
</div>


<?php echo do_shortcode('[otman_bulk_mail]'); ?> 
<!-- BULK GSM SEND -->
<div id="bulk-gsm-controls"
     style="margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
  <button type="button" id="bulk-gsm-send"
    style="padding:6px 14px; font-size:14px; background:#2f2faa; color:#fff; border:0; border-radius:4px; font-weight:600;">
    Send valgte til GSM
  </button>
  <span id="bulk-gsm-progress" style="font-size:13px; color:#666;"></span>
</div>
<div id="bulk-gsm-results" style="margin:8px 0 18px 0; font-family:monospace; font-size:13px; line-height:1.5;"></div>

<div>
	<button type="button" id="bulk-duplicate-apply"
  style="padding: 6px 14px 6px 14px; margin-bottom:14px; background: #fff; color: #2f2faa; border: 2px solid #2f2faa; border-radius: 4px; font-weight: 600;">
  Kopier valgte
</button>
	
   <button type="button" id="download_excel"
                style="padding: 6px 14px 6px 14px; margin-bottom:14px; background: #fff; color: #2f2faa; border: 2px solid #2f2faa; border-radius: 4px; font-weight: 600;">
          Last ned Excel
        </button>
</div>


    <!-- TABLE WRAPPER -->
    <div id="admin-order-table-wrapper"></div>

    <!-- IFRAME MODAL -->
    <div id="iframe-modal"
         style="display:none;position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.6);z-index:9999;overflow-y:auto;padding:40px 20px;box-sizing:border-box">
      <div style="position:relative;width:90%;max-width:1000px;height:90vh;background:#fff;border-radius:12px;overflow:hidden;margin:auto;display:flex;flex-direction:column">
        <button onclick="document.getElementById('iframe-modal').style.display='none'"
               class="modal-close-btn iframe-modal-close" type="button">
          &times;
        </button>
        <iframe id="iframe-content" src="" style="width:100%;height:100%;border:none"></iframe>
      </div>
    </div>

    <!-- SUMMARY MODAL -->
    <div id="order-modal" class="order-modal" style="display:none;max-width:1200px;width:90%;margin:auto">
      <div class="order-modal-content"
           style="display:flex;gap:30px;padding:20px;background:#fff;border-radius:8px;position:relative;box-shadow:0 0 15px rgba(0,0,0,.1)">
        <span class="modal-close-btn order-modal-close">
          &times;
        </span>
     <div id="order-modal-actions"
     style="position:absolute; top:10px; left:20px; z-index:10; display:flex; gap:10px; flex-wrap:wrap;">
  <button id="modal-export-pdf-button" class="order-export-button"
          style="padding:6px 14px; font-size:13px; background:transparent; color:#113357; border:2px solid #113357; border-radius:4px; cursor:pointer; transition:all .3s ease;">
    Last ned PDF
  </button>
</div>

        <div id="order-modal-body"
             style="width:100%;margin-top:60px;display:flex;gap:40px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6">
        </div>
      </div>
    </div>

    <!-- STYLES -->
    <style>
      .order-modal {
        position:fixed; inset:0; width:100vw; height:100vh;
        background:rgba(0,0,0,.6); display:none;
        align-items:center; justify-content:center;
        z-index:9999; overflow-y:auto;
      }
      .pagination-wrapper { margin-top:25px; text-align:center; user-select:none; }
      .pagination-wrapper button {
        margin:0 4px; padding:6px 14px; font-size:13px; background:transparent;
        color:#2F2FAA; border:2px solid #2F2FAA; border-radius:4px;
        cursor:pointer; transition:all .3s; min-width:38px; font-weight:600
      }
      .pagination-wrapper button:hover:not(:disabled) { background:#2F2FAA; color:#fff }
      .pagination-wrapper button:disabled { opacity:.4; cursor:default }
      .pagination-wrapper button.active {
        font-weight:bold; text-decoration:underline; background:#2F2FAA; color:#fff; cursor:default
      }
		
		/* Match user modal behaviour for the embedded FEA form */
#order-modal .order-detail-fea { border:0 !important; display:none !important; }
#order-modal .order-detail-fea.order-detail-fea--visible { display:block !important; }
#order-modal .order-detail-fea .acf-fields > .acf-field:first-child { border-top:0 !important; }
#order-modal .order-detail-fea hr { display:none !important; }

		


    </style>
<style id="bulk-controls-uniform">
  /* Rows layout (unchanged) */
  #bulk-status-controls,
	#bulk-driver-text-controls,
  #bulk-driver-controls,
  #bulk-subcontractor-controls{
    display:flex; align-items:center; gap:8px; flex-wrap:wrap;
    margin-bottom:12px;
  }

  /* === Shared tokens to match the rest of the page === */
  :root{
    --bulk-font-size:13px;
    --bulk-font-weight:500;     /* change to 400 if you want even lighter */
    --bulk-height:32px;         /* align with your other controls */
    --bulk-radius:6px;
    --bulk-select-width:240px;  /* identical width for ALL three selects */
    --bulk-button-width:200px;  /* identical width for ALL three buttons */
    --bulk-pad-x:10px;          /* tighter padding to match other buttons */
    --bulk-primary:#2f2faa;
    --bulk-arrow:#666;
  }

  /* ============ SELECTS ============ */
  #bulk-status-controls select,
	
  #bulk-driver-controls select,
  #bulk-subcontractor-controls select{
    -webkit-appearance:none !important;
    appearance:none !important;
    font-family:inherit !important;
    font-size:var(--bulk-font-size) !important;
    font-weight:var(--bulk-font-weight) !important;
    height:var(--bulk-height) !important;
    line-height:var(--bulk-height) !important; /* keeps the text vertically centered */
    padding:0 calc(var(--bulk-pad-x) + 18px) 0 var(--bulk-pad-x) !important; /* room for arrow */
    border:1px solid #ccc !important;
    border-radius:var(--bulk-radius) !important;
    background:#fff
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>")
      no-repeat right 10px center !important;
    color:#111 !important;
    box-sizing:border-box !important;
    width:var(--bulk-select-width) !important;
    max-width:var(--bulk-select-width) !important;   /* ✅ fixes wider subcontractor select */
  }
  /* hide legacy IE arrow if any */
  #bulk-status-controls select::-ms-expand,
  #bulk-driver-controls select::-ms-expand,
  #bulk-subcontractor-controls select::-ms-expand{ display:none; }

  /* ============ BUTTONS ============ */
  #bulk-status-controls button,
  #bulk-driver-text-controls button,
	
  #bulk-subcontractor-controls button{
    -webkit-appearance:none !important;
    appearance:none !important;
    font-family:inherit !important;
    font-size:var(--bulk-font-size) !important;
    font-weight:var(--bulk-font-weight) !important;
    height:var(--bulk-height) !important;
    line-height:1 !important;
    padding:2 var(--bulk-pad-x) !important;          /* ✅ tighter padding like other buttons */
    border-radius:var(--bulk-radius) !important;
    background:var(--bulk-primary) !important;
    color:#fff !important;
    border:none !important;
    width:var(--bulk-button-width) !important;       /* ✅ identical widths */
    cursor:pointer !important;
    transition:filter .2s ease !important;
  }
  #bulk-status-controls button:hover,
  #bulk-driver-controls button:hover,
  #bulk-subcontractor-controls button:hover{ filter:brightness(.95); }

  /* Mobile: stretch full-width */
  @media (max-width: 767px){
    #bulk-status-controls,
    #bulk-driver-controls,
    #bulk-subcontractor-controls{ flex-direction:column; align-items:stretch; }
    #bulk-status-controls select,
    #bulk-driver-controls select,
    #bulk-subcontractor-controls select,
    #bulk-status-controls button,
    #bulk-driver-controls button,
    #bulk-subcontractor-controls button{ width:100% !important; max-width:100% !important; }
  }
</style>





    <!-- LIBRARIES + MAIN SCRIPT -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

<!-- XLSX  -->
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
    <script>
    document.addEventListener('DOMContentLoaded', function(){

      const tableWrapper = document.getElementById('admin-order-table-wrapper');
      const iframeModal  = document.getElementById('iframe-modal');
      const iframe       = document.getElementById('iframe-content');
      const filterForm   = document.getElementById('admin-order-filter-form');
      const resetBtn     = document.getElementById('order-reset-button');
      const downloadBtn  = document.getElementById('download_pdf');
      const searchInput  = document.getElementById('order_search');
      let currentPage=1, maxPage=1, searchTimeout;

      // 1) Load & render via AJAX
      function loadTable(paged=1) {
        currentPage=paged;
        const fd=new FormData(filterForm);
      fd.append('action','load_admin_order_table');
fd.append('posts_per_page', document.getElementById('posts_per_page')?.value || '');

        fd.append('paged',paged);
		  fd.append('slug_id_search', document.getElementById('slug_id_search')?.value || '');

        fetch('<?php echo admin_url('admin-ajax.php') ?>',{method:'POST',body:fd})
          .then(r=>r.json()).then(data=>{
            tableWrapper.innerHTML=data.html;
			attachCheckboxLogic(); 
            maxPage=data.max_pages;
            renderPagination();
          });
      }
function attachCheckboxLogic() {
  const selectAll = document.getElementById('select-all-orders');
  if (selectAll) {
    selectAll.addEventListener('change', function () {
      const isChecked = this.checked;
      document.querySelectorAll('.admin-order-history-table .bulk-select').forEach(cb => {
        cb.checked = isChecked;
      });
    });
  }

  // Prevent checkbox clicks from triggering the modal
  document.querySelectorAll('.admin-order-history-table .bulk-select').forEach(cb => {
    cb.addEventListener('click', e => {
      e.stopPropagation(); // ✅ stops row click bubbling
    });
  });
}
  async function sendChunkToGSM(ids) {
    const body = new URLSearchParams({
      action: 'bulk_send_to_gsm',
      nonce: (window.OTMAN_GSM_NONCE || ''),
      post_ids: JSON.stringify(ids)
    });
    const res = await fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
      method: 'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body
    }).then(r => r.json());
    if (!res || !res.success) {
      throw new Error(res?.data?.message || 'Ukjent feil ved GSM-utsending.');
    }
    return res.data; // { results: [{post_id, ok, http, gsm_id, msg}], sent }
  }

  document.getElementById('bulk-gsm-send')?.addEventListener('click', async function () {
    const btn      = this;
    const progress = document.getElementById('bulk-gsm-progress');
    const results  = document.getElementById('bulk-gsm-results');

    const selected = Array.from(document.querySelectorAll('.admin-order-history-table .bulk-select:checked'))
                    .map(cb => parseInt(cb.value, 10))
                    .filter(Boolean);

    if (!selected.length) { alert('Velg minst én bestilling.'); return; }

    btn.disabled = true;
    const oldTxt = btn.textContent;
    btn.textContent = 'Sender…';
    progress.textContent = `0 / ${selected.length}`;
    results.textContent = '';

    const chunkSize = 5; // keep requests light
    let done = 0;

    try {
      for (let i = 0; i < selected.length; i += chunkSize) {
        const chunk = selected.slice(i, i + chunkSize);
        const data  = await sendChunkToGSM(chunk);

        // Append per-order rows
        (data?.results || []).forEach(row => {
          const line =
            (row.ok ? '✅' : '❌') +
            ` #${row.post_id}` +
            (row.gsm_id ? ` → GSM order ${row.gsm_id}` : '') +
            (row.http ? ` [HTTP ${row.http}]` : '') +
            (row.msg ? ` — ${row.msg}` : '');
          results.insertAdjacentHTML('beforeend', line.replace(/</g,'&lt;') + '<br>');
        });

        done += chunk.length;
        progress.textContent = `${done} / ${selected.length}`;
      }
      btn.textContent = 'Ferdig';
      setTimeout(() => { btn.textContent = oldTxt; btn.disabled = false; }, 1200);
    } catch (e) {
      results.insertAdjacentHTML('beforeend', `<div style="color:#b00">Feil: ${String(e.message || e)}</div>`);
      btn.disabled = false; btn.textContent = oldTxt;
    }
  });

					  
					
document.getElementById('bulk-status-apply')?.addEventListener('click', async function () {
  const newStatus = document.getElementById('bulk-status-select')?.value;
  const ids = Array.from(document.querySelectorAll('.admin-order-history-table .bulk-select:checked'))
                   .map(cb => cb.value);

  if (!newStatus) { alert('Velg en status først.'); return; }
  if (!ids.length) { alert('Velg minst én bestilling.'); return; }

  // ✅ Extra GDPR confirmation when setting to Paid
  if (newStatus === 'Betalt') {
    const msg = [
      `Du er i ferd med å sette status til "Betalt" på ${ids.length} bestilling(er).`,
      `Dette vil slette kundedata permanent (GDPR):`,
      `• Kundens navn, e-post, kass. navn/telefon`,
      `• Pickup/leveringsadresse(r), returadresse`,
      `• Ekstra pickup-rader`,
      ``,
      `Er du sikker? Dette kan ikke angres.`
    ].join('\n');
    if (!confirm(msg)) return;
  }

  // UI lock
  const btn = this; btn.disabled = true; const old = btn.textContent;
  const chunkSize = 50;
  let done = 0;

  try {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      btn.textContent = `Oppdaterer… ${done}/${ids.length}`;
      const res = await fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
        method: 'POST',
        headers: {'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
          action: 'bulk_update_order_status',
          post_ids: JSON.stringify(chunk),
          status: newStatus
        })
      }).then(r => r.json());
      if (!res?.success) throw new Error(res?.data?.message || 'Feil under oppdatering.');
      done += chunk.length;
    }
    alert(`Status oppdatert på ${done} bestilling(er).`);
    // Optional: reload/refresh after bulk
    if (typeof loadTable === 'function') loadTable(1);
  } catch (e) {
    alert(e.message || 'Noe gikk galt.');
  } finally {
    btn.disabled = false; btn.textContent = old;
  }
});

	
		
		document.getElementById('bulk-duplicate-apply')?.addEventListener('click', function () {
  const checkboxes = document.querySelectorAll('.admin-order-history-table .bulk-select:checked');
  const selectedIDs = Array.from(checkboxes).map(cb => cb.value);

  if (selectedIDs.length === 0) {
    alert('Velg minst én bestilling å kopiere.');
    return;
  }

  // Optional: confirm
  if (!confirm(`Kopiere ${selectedIDs.length} valgt(e) bestilling(er)?`)) return;

  fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'bulk_duplicate_orders',
      post_ids: JSON.stringify(selectedIDs)
    })
  })
 .then(r => r.json())
.then(data => {
  if (!data?.success) {
    alert(data?.data?.message || 'Kopiering feilet.');
    return;
  }
  const created = data?.data?.new_ids || [];
  alert(`Kopiert ${created.length} bestilling(er).`);

  if (typeof loadTable === 'function') loadTable(currentPage || 1);

  if (created[0]) {
    const iframeModal = document.getElementById('iframe-modal');
    const iframe = document.getElementById('iframe-content');
    if (iframe && iframeModal) {
      iframe.src = `/power-order-edit/?post_id=${created[0]}`;
      iframeModal.style.display = 'flex';
    }
  }
})

  .catch(() => alert('Noe gikk galt under kopieringen.'));
});

	
document.getElementById('bulk-driver-text-apply')?.addEventListener('click', function () {
  const driver = (document.getElementById('bulk-driver-text')?.value || '').trim();
  const ids = Array.from(document.querySelectorAll('.admin-order-history-table .bulk-select:checked'))
                   .map(cb => cb.value);

  if (!driver) { alert('Skriv inn sjåførnavn først.'); return; }
  if (!ids.length) { alert('Velg minst én bestilling.'); return; }

  const btn = this; btn.disabled = true; const old = btn.textContent;
  btn.textContent = 'Oppdaterer…';

  fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'bulk_update_order_driver_text',
      post_ids: JSON.stringify(ids),
      driver: driver
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data?.success) {
      const n = data?.data?.updated ?? 0;
      alert(`Oppdatert sjåfør på ${n} bestilling(er).`);
      document.getElementById('bulk-driver-text').value = '';
      if (typeof loadTable === 'function') loadTable(1);
    } else {
      alert(data?.data?.message || 'Oppdatering feilet.');
    }
  })
  .catch(() => alert('Noe gikk galt.'))
  .finally(() => { btn.disabled = false; btn.textContent = old; });
});



document.getElementById('bulk-subcontractor-apply')?.addEventListener('click', function () {
  const subcontractor = document.getElementById('bulk-subcontractor-select')?.value || '';
  const checkboxes = document.querySelectorAll('.admin-order-history-table .bulk-select:checked');
  const selectedIDs = Array.from(checkboxes).map(cb => cb.value);

  if (!subcontractor) { alert('Velg en subcontractor først .'); return; }
  if (selectedIDs.length === 0) { alert('Velg minst én bestilling å oppdatere.'); return; }

  fetch('<?php echo admin_url('admin-ajax.php'); ?>', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'bulk_update_order_subcontractor',
      post_ids: JSON.stringify(selectedIDs),
      subcontractor: subcontractor
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data?.success) {
      const n = data?.data?.updated ?? 0;
      alert(`Oppdatert subcontractor på ${n} bestilling(er).`);
      // ✅ reload table
      if (typeof loadTable === 'function') loadTable(currentPage);
      // ✅ reset the dropdown back to the placeholder ("Velg …")
      const sel = document.getElementById('bulk-subcontractor-select');
      if (sel) {
        sel.value = '';                // go back to the empty option
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sel.blur();
      }
    } else {
      alert(data?.data?.message || 'Oppdatering feilet.');
    }
  })
  .catch(() => alert('Noe gikk galt.'));
});
		
		
      // 2) Pagination controls
      function renderPagination(){
        let html='<div class="pagination-wrapper">';
        html+=`<button ${currentPage===1?'disabled':''} data-page="1">&laquo;</button>`;
        html+=`<button ${currentPage===1?'disabled':''} data-page="${currentPage-1}">&lsaquo;</button>`;
       let range = 4;
		  
let start = Math.max(1, currentPage - range);
let end = Math.min(maxPage, start + 7);

if (end - start < 7) {
  start = Math.max(1, end - 7);
}

        for(let i=start;i<=end;i++){
          html+=`<button class="${i===currentPage?'active':''}" data-page="${i}">${i}</button>`;
        }
        html+=`<button ${currentPage===maxPage?'disabled':''} data-page="${currentPage+1}">&rsaquo;</button>`;
        html+=`<button ${currentPage===maxPage?'disabled':''} data-page="${maxPage}">&raquo;</button>`;
        html+='</div>';
        const old=tableWrapper.querySelector('.pagination-wrapper');
        if(old) old.remove();
        tableWrapper.insertAdjacentHTML('beforeend',html);
      }

      // 3) Delegated click handling
      document.addEventListener('click', function(e){

        // → Pagination
        if(e.target.closest('.pagination-wrapper button')){
          e.preventDefault();
          loadTable(parseInt(e.target.dataset.page));
          return;
        }

        // → Row → open iframe
        const row=e.target.closest('.order-row');
        if(row){
          iframe.src=`/power-order-edit/?post_id=${row.dataset.postId}`;
          iframeModal.style.display='flex';
          return;
        }

      // → Close summary modal
if (e.target.matches('.order-modal-close')) {
  window.closeOrderModal?.();
  return;
}


        // → Download summary PDF
        if(e.target.matches('#modal-export-pdf-button')){
          e.preventDefault();
          safariPDFDownload(
            document.querySelector('#order-modal-body'),
            'ordre-detaljer.pdf'
          );
          return;
        }
      });

      // 4) PDF helper (shared)
      async function safariPDFDownload(el, fn){
        const canvas=await html2canvas(el,{scale:2,useCORS:true});
        const img=canvas.toDataURL('image/png');
        const pdf=new jspdf.jsPDF('p','pt','a4');
        const w=pdf.internal.pageSize.getWidth();
        const h=canvas.height*w/canvas.width;
        pdf.addImage(img,'PNG',20,20,w-40,h);
        pdf.save(fn);
      }

      // 5) Filters & table export
      filterForm.addEventListener('submit',e=>{e.preventDefault();loadTable(1)});
     ['order_status','order_author','order_driver','order_subcontractor'].forEach(id =>
  document.getElementById(id)?.addEventListener('change', () => loadTable(1))
);

      searchInput?.addEventListener('input',()=>{
        clearTimeout(searchTimeout);
        searchTimeout=setTimeout(()=>loadTable(1),400);
      });
											  
											  document.getElementById('slug_id_search')?.addEventListener('input', function () {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadTable(1), 400);
});
document.getElementById('slug_id_search')?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadTable(1), 400);
});

resetBtn?.addEventListener('click',()=>{
  filterForm.reset();
  const idInput = document.getElementById('slug_id_search');
  if (idInput) {
    idInput.value = '';
    idInput.dispatchEvent(new Event('input')); // 🔁 trigger live search
  }
});

					
											  
	document.querySelectorAll('.quick-date-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const offset = parseInt(btn.dataset.days);
    const today = new Date();
    today.setDate(today.getDate() + offset);

    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const formatted = `${yyyy}-${mm}-${dd}`;

    document.getElementById('date_from').value = formatted;
    document.getElementById('date_to').value = formatted;

    // ✅ Auto-trigger the filter form submit
    document.getElementById('admin-order-filter-form').dispatchEvent(new Event('submit'));
  });
});
										  
											  
											  
											  



      downloadBtn?.addEventListener('click',async e=>{
        e.preventDefault();
        const c=await html2canvas(tableWrapper,{scale:2,useCORS:true});
        const img=c.toDataURL('image/png');
        const pdf=new jspdf.jsPDF('p','pt','a4');
        const w=pdf.internal.pageSize.getWidth();
        const h=c.height*w/c.width;
        pdf.addImage(img,'PNG',20,20,w-40,h);
        pdf.save('ordre-tabell.pdf');
      });

      // 6) Excel export

		
function getTableData(table) {
  const rows = Array.from(table.querySelectorAll('tr'));

  return rows
    .map(row =>
      Array.from(row.querySelectorAll('th,td'))
        .slice(1) // 👈 SKIP the first column (checkbox column)
        .map(cell => cell.innerText.trim())
    )
    .filter(row => row.some(cell => cell !== '')); // remove empty rows
}


document.getElementById('download_excel').addEventListener('click', function(e){
  e.preventDefault();
  const tableEl = document.querySelector('#admin-order-table-wrapper table');
  if (!tableEl) {
    alert('Ingen data å eksportere.');
    return;
  }

  const data = getTableData(tableEl); // rows as string arrays

  const ws = XLSX.utils.aoa_to_sheet(data); // AOA = array of arrays
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');

  XLSX.writeFile(wb, 'ordre-tabell.xlsx');
});



      // 7) **Iframe-postMessage success listener**
      window.addEventListener("message", function(event) {
        if (
          typeof event.data === "object" &&
          event.data.type === "closeIframeModalWithMessage"
        ) {
          // Close iframe modal
          const m = document.getElementById("iframe-modal");
          const f = document.getElementById("iframe-content");
          if (m) m.style.display = "none";
          if (f) f.src = "";

          // Remove old overlays
          document.getElementById("acf-success-overlay-message")?.remove();
          document.getElementById("acf-success-overlay-backdrop")?.remove();

          // Build and show new success overlay
          const backdrop = document.createElement("div");
          backdrop.id = "acf-success-overlay-backdrop";
          document.body.appendChild(backdrop);

          const wrapper = document.createElement("div");
          wrapper.id = "acf-success-overlay-message";
          wrapper.className = "acf-notice acf-success-message";
          wrapper.innerHTML = `
            <button class="close-x" aria-label="Lukk">&times;</button>
            <div class="acf-success-content">${event.data.html}</div>
          `;
          document.body.appendChild(wrapper);

          wrapper.querySelector(".close-x").addEventListener("click", () => {
            backdrop.remove();
            wrapper.remove();
          });

          // Refresh table
          if (typeof loadTable === "function") loadTable(1);
        }
      }); // end message listener

      // INITIAL LOAD
      loadTable();
    });
    </script>
<?php $gsm_nonce = wp_create_nonce('otman_gsm_bulk'); ?>
<script>window.OTMAN_GSM_NONCE = "<?php echo esc_js($gsm_nonce); ?>";</script>

<script>
document.addEventListener('DOMContentLoaded', function () {
  // ✅ Select-all checkbox logic
  const selectAll = document.getElementById('select-all-orders');
  if (selectAll) {
    selectAll.addEventListener('change', function () {
      const isChecked = this.checked;
      document.querySelectorAll('.admin-order-history-table .bulk-select').forEach(cb => {
        if (cb.closest('tr')?.offsetParent !== null) {
          cb.checked = isChecked;
        }
      });
    });
  }

  // ✅ Prevent checkbox click from triggering row open
  document.getElementById('admin-order-table-wrapper')?.addEventListener('click', function (e) {
    if (e.target.matches('input[type="checkbox"]')) return;

 const row = e.target.closest('.order-row');
if (row) {

      document.getElementById('iframe-content').src = `/power-order-edit/?post_id=${row.dataset.postId}`;
      document.getElementById('iframe-modal').style.display = 'flex';
    }
  });
});
</script>
<script>
document.addEventListener('DOMContentLoaded', function(){
  ['bulk-status-controls','bulk-driver-controls','bulk-subcontractor-controls']
    .forEach(id => document.getElementById(id)?.classList.add('bulk-controls'));
});
</script>

<script>
(function () {
  // Only touch the summary modal (#order-modal), not the iframe modal.
  function getSummaryModal() {
    return document.getElementById('order-modal');
  }
  function closeOnlySummaryModal() {
    const m = getSummaryModal();
    if (m) m.style.display = 'none'; // no reload, no iframe changes
  }

  // Make *all* close paths use the lightweight close:
  // - the X button
  // - clicking the backdrop
  // - pressing ESC
  document.addEventListener('click', function (e) {
    if (e.target.closest('.order-modal-close')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      closeOnlySummaryModal();
    }
  }, true);

  document.addEventListener('pointerdown', function (e) {
    const m = getSummaryModal();
    if (!m || getComputedStyle(m).display === 'none') return;
    const content = m.querySelector('.order-modal-content');
    if (e.target === m && !content.contains(e.target)) {
      e.preventDefault();
      closeOnlySummaryModal();
    }
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeOnlySummaryModal();
    }
  }, true);

  // If any shared script defined a "reload" closer, override it here for admin.
  window.closeOrderModal = closeOnlySummaryModal;
})();
</script>



    <?php
    return ob_get_clean();
}

function valid_text($value) {
    $value = trim((string)$value);
    return $value !== '' && $value !== '-';
}

/**
 * Render attachments grid from ACF "Upload files" field by KEY with resilient parsing.
 * Uses .fea-uploads-attachment tiles so your lightbox picks them up.
 */
function otman_render_attachments_grid( int $post_id ): string {
    if ($post_id <= 0 || get_post_type($post_id) !== 'power_order') {
        return '<div class="fea-uploads"><p>Ingen vedlegg funnet.</p></div>';
    }

    // Try by KEY first (your webhook plugin uses this key: field_68c1736ae8610)
    $val = function_exists('get_field') ? get_field('field_68c1736ae8610', $post_id) : null;

    // Fallback by name if needed
    if (empty($val)) {
        $val = get_post_meta($post_id, 'upload_files', true);
    }

    // Normalize to array of attachment IDs
    $ids = [];
    $push = static function($maybe) use (&$ids) {
        if (is_numeric($maybe)) { $ids[] = (int)$maybe; return; }
        if (is_array($maybe)) {
            if (isset($maybe['ID'])) { $ids[] = (int)$maybe['ID']; return; }
            if (isset($maybe['id'])) { $ids[] = (int)$maybe['id']; return; }
            if (isset($maybe['url'])) {
                $aid = attachment_url_to_postid($maybe['url']);
                if ($aid) $ids[] = (int)$aid;
            }
        }
    };

    if (is_array($val)) {
        foreach ($val as $item) { $push($item); }
    } elseif (!empty($val)) {
        $push($val);
    }

    $ids = array_values(array_filter(array_unique(array_map('intval', $ids))));
    if (!$ids) {
        return '<div class="fea-uploads"><p>Ingen vedlegg funnet.</p></div>';
    }

    ob_start();
    echo '<div class="fea-uploads" id="attachments-fallback-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">';
    foreach ($ids as $aid) {
        $url   = wp_get_attachment_url($aid);
        $thumb = wp_get_attachment_image_url($aid, 'medium') ?: $url;
        $name  = get_the_title($aid) ?: basename($url);
        if (!$url) { continue; }
        ?>
        <div class="fea-uploads-attachment" data-href="<?php echo esc_url($url); ?>" data-name="<?php echo esc_attr($name); ?>" style="background:#f7f7fa;border:1px solid #e6e6ef;border-radius:8px;overflow:hidden">
          <div class="thumbnail" style="aspect-ratio:1/1;display:flex;align-items:center;justify-content:center">
            <img src="<?php echo esc_url($thumb); ?>" alt="<?php echo esc_attr($name); ?>" style="max-width:100%;max-height:100%;display:block" />
          </div>
          <div class="filename" style="font-size:12px;padding:6px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><?php echo esc_html($name); ?></div>
        </div>
        <?php
    }
    echo '</div>';
    return ob_get_clean();
}

/** AJAX: return fallback grid HTML for a post_id */
add_action('wp_ajax_otman_fetch_attachments', function () {
    $post_id = (int) ($_POST['post_id'] ?? 0);
    echo otman_render_attachments_grid($post_id);
    wp_die();
});
add_action('wp_ajax_nopriv_otman_fetch_attachments', function () {
    $post_id = (int) ($_POST['post_id'] ?? 0);
    echo otman_render_attachments_grid($post_id);
    wp_die();
});


function otman_get_last_editor_name( int $post_id ): string {
    $uid = (int) get_post_meta($post_id, '_edit_last', true);

    if (!$uid) {
        // Fallback: latest revision author
        $revs = wp_get_post_revisions($post_id, [
            'numberposts' => 1,
            'orderby'     => 'date',
            'order'       => 'DESC',
        ]);
        if (!empty($revs)) {
            $last = reset($revs);
            $uid  = (int) $last->post_author;
        }
    }

    if (!$uid) {
        // Final fallback: original post author
        $uid = (int) get_post_field('post_author', $post_id);
    }

    $user = $uid ? get_userdata($uid) : null;
    return $user ? ($user->display_name ?: $user->user_login) : '';
}






add_action('wp_ajax_load_admin_order_table', function () {
    $selected_status = sanitize_text_field($_POST['order_status'] ?? '');
    $search_term     = sanitize_text_field($_POST['order_search'] ?? '');
	$slug_id_search  = sanitize_text_field($_POST['slug_id_search'] ?? '');
$post__in = [];



    $date_from       = sanitize_text_field($_POST['date_from'] ?? '');
    $date_to         = sanitize_text_field($_POST['date_to'] ?? '');
	$selected_driver = sanitize_text_field($_POST['order_driver'] ?? '');
	$selected_subcontractor = sanitize_text_field($_POST['order_subcontractor'] ?? '');

    $paged           = max(1, intval($_POST['paged'] ?? 1));
   $posts_per_page = intval($_POST['posts_per_page'] ?? 100);
if ($posts_per_page < 1) $posts_per_page = 100;


    // 1) Build a meta_query with an explicit top‐level AND relation
    $meta_query = [
      'relation' => 'AND'
    ];
$post__in = [];

if ($slug_id_search !== '') {
  $post_id_candidate = intval($slug_id_search);
  $maybe_post = get_post($post_id_candidate);

  if ($maybe_post && $maybe_post->post_type === 'power_order') {
    $post__in[] = $post_id_candidate;
  } else {
    $post__in = [0]; // no match
  }
}

    // — Status filter 
// — Status filter (treat "Behandles" as default/empty and support legacy "Behandling")
if ($selected_status) {
 if ($selected_status !== '') {
  $meta_query[] = ['key'=>'status','value'=>$selected_status,'compare'=>'='];
}

}



    // 2) Global search across multiple fields
    if ($search_term !== '') {
      // **List exactly the meta_keys you want to hit**:
      $fields = [
        'bestillingsnr','kundens_navn','telefon','leveringsdato','total_price',
        'pickup_address','delivery_address','returadresse',
        'tidsvindu_for_levering','beskrivelse','e-postadresse','etasje_nr',
        'kasserers_navn','kasserers_telefon','driver','contact_notes','bomtur','status_notes','slug_numeric_id'
      ];

      // Wrap those in an inner OR clause
      $or = ['relation'=>'OR'];
      foreach ($fields as $key) {
        $or[] = [
          'key'     => $key,
          'value'   => $search_term,
          'compare' => 'LIKE'
        ];
      }

      // **IMPORTANT**: if you absolutely need to search inside an ACF repeater sub-field
      // like extra_pickup_locations → pickup, you’ll need to add its exact meta_key:
      //   $or[] = [ 'key'=>'extra_pickup_locations_0_pickup', … ] etc.
      // Otherwise skip the repeater itself—WP only searches the serialized count, not its rows.

      $meta_query[] = $or;
    }


    // 3) Date query 
  if ($date_from || $date_to) {
  $meta_query[] = [
    'key'     => 'leveringsdato',
    'value'   => array_filter([$date_from, $date_to]),
    'compare' => 'BETWEEN',
    'type'    => 'DATE'
  ];
}
if (!empty($selected_driver)) {
  $meta_query[] = [
    'key'     => 'driver',
    'value'   => $selected_driver,
    'compare' => '='
  ];
}
if (!empty($selected_subcontractor)) {
  $meta_query[] = [
    'key'     => 'subcontractor',
    'value'   => $selected_subcontractor,
    'compare' => '='
  ];
}

    // 4)WP_Query args
    // 
$args = [
  'post_type'      => 'power_order',
  'posts_per_page' => $posts_per_page,
  'paged'          => $paged,
  'post_status'    => 'publish',
  'meta_query'     => $meta_query,
  'meta_key'       => 'leveringsdato_sortable',
  'orderby'        => [
    'meta_value' => 'DESC',
    'tidsvindu_for_levering' => 'ASC',
  ],
  'post__in'       => $post__in,
];



    if (!empty($_POST['order_author'])) {
      $args['author'] = intval($_POST['order_author']);
    }
	

   if ($date_from || $date_to) {
  $meta_query[] = [
    'key'     => 'leveringsdato',
    'value'   => array_filter([$date_from, $date_to]),
    'compare' => 'BETWEEN',
    'type'    => 'DATE'
  ];
}


    $query = new WP_Query($args);
    $max_pages = $query->max_num_pages;
    ob_start();
    echo '<table class="order-history-table admin-order-history-table"><thead><tr><th><input type="checkbox" id="select-all-orders"></th><th>ID</th><th>Status</th><th>Leveringsdato</th><th>Tidsvindu for levering</th><th>Customer</th><th>Best.nr</th><th>Navn</th><th>Telefon</th><th>Pickup Adresse</th><th>Extra pickup</th><th>Leveringsadresse</th><th>Returadresse</th><th>Produkter</th><th>Leveringstype</th><th>Montering/retur</th><th>Beskrivelse</th><th>Kasserers navn</th><th>Kasserers telefon</th><th>Kundenotater</th><th>Driver Info</th><th>Bestillingsdato</th><th>Sist redigert</th><th>Pris uten MVA</th><th>Pris Subcontractor</th></tr></thead><tbody>';

    while ($query->have_posts()) : $query->the_post();
        $post_id = get_the_ID();
        $status_val = get_field('status', $post_id) ?: 'Behandles';
        $status_label = get_field_object('field_682dd6dba40f7')['choices'][$status_val] ?? $status_val;
        $status_class = 'status-' . sanitize_title(strtolower($status_val));
$price_html = get_field('price_breakdown_html', $post_id);
$products_list = [];
$delivery_labels = [];

if (!empty($price_html)) {
    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    $doc->loadHTML('<?xml encoding="UTF-8">' . $price_html);
    libxml_clear_errors();
    $xpath = new DOMXPath($doc);

    // Extract product group labels
    $groups = $xpath->query('//div[contains(@class,"price-group-label")]');
    foreach ($groups as $group) {
        $label = trim($group->textContent);
        if (!in_array($label, $products_list)) {
            $products_list[] = $label;
        }
    }

    // Extract only labels (without codes) for delivery types
    $rows = $xpath->query('//span[contains(@class,"price-breakdown-label")]');
    foreach ($rows as $row) {
        $text = trim($row->textContent);

        // Match "Label (CODE)" pattern and only extract label
        if (preg_match('/^(.*?)\s*\(([^)]+)\)$/', $text, $matches)) {
            $label = trim($matches[1]);
            $code = strtoupper(trim($matches[2]));

            if (in_array($code, ['SIDEBYSIDETRAPP', 'SIDEBYSIDE', 'DELIVERY', 'INDOOR', 'XTRA'])) {
                $delivery_labels[] = $label;
            }
        }
    }
}
$other_services = [];

$excluded_codes = ['DELIVERY', 'INDOOR', 'XTRA', 'SIDEBYSIDE', 'SIDEBYSIDETRAPP'];
$excluded_labels = ['MVA', 'Total', 'KM pris', 'Ekspresslevering'];

// Loop over each product group (price-group)
$groups = $xpath->query('//div[contains(@class,"price-group")]');
foreach ($groups as $group) {
    $rows = $xpath->query('.//span[contains(@class,"price-breakdown-label")]', $group);

    foreach ($rows as $row) {
        $text = trim($row->textContent);

        // Skip items like MVA, Total, KM pris, etc.
        if (array_filter($excluded_labels, fn($e) => stripos($text, $e) !== false)) {
            continue;
        }

        // If label has a code, extract it
        if (preg_match('/^(.*?)\s*\(([^)]+)\)$/', $text, $matches)) {
            $label = trim($matches[1]);
            $code = strtoupper(trim($matches[2]));

            // Only keep it if code is NOT one of the delivery types
            if (!in_array($code, $excluded_codes)) {
                $other_services[] = $label;
            }
        } else {
            // If no code, just use label directly (if it's not excluded)
            $other_services[] = $text;
        }
    }
}
// Append "Type vegg" selections to Montering/retur column
$type_vegg_keys = [
  'field_68516165c7799', // Type vegg
  'field_685168249e0f0', // Type vegg
  'field_688231ba5dbb6', // Type vegg kombi
  'field_688237ea9387b'  // Type vegg kombi
];

$type_vegg_values = [];

if (have_rows('field_682b0fa395c44', $post_id)) { // your flexible content field key
    while (have_rows('field_682b0fa395c44', $post_id)) {
        the_row();
     foreach ($type_vegg_keys as $key) {
    $values = get_sub_field($key);
    if (!empty($values) && is_array($values)) {
        foreach ($values as $v) {
            $v = trim($v);
            if ($v !== '') {
                $type_vegg_values[] = $v;
            }
        }
    }
}

    }
}

if (!empty($type_vegg_values)) {
    $other_services[] = 'Type vegg: ' . implode(', ', array_unique($type_vegg_values));
}

        echo '<tr class="order-row" data-post-id="' . esc_attr($post_id) . '">';
	$slug = get_post_field('post_name', $post_id);
$slug_number = '';
if (preg_match('/(\d+)$/', $slug, $match)) {
    $slug_number = $match[1];
}


echo '<tr class="order-row" data-post-id="' . esc_attr($post_id) . '">';
echo '<td><input type="checkbox" class="bulk-select" value="' . esc_attr($post_id) . '"></td>';
echo '<td>' . esc_html($post_id) . '</td>'; // ✅ Show actual WP post ID // FIRST COLUMN
        echo '<td><span class="order-status ' . esc_attr($status_class) . '"><span class="status-dot"></span><span class="order-status-text">' . esc_html($status_label) . '</span></span></td>';

	
	$raw_date = get_field('leveringsdato', $post_id);
$formatted_date = '';

// 1. Excel float serial fix: 45967 = 2025-07-30
if (is_numeric($raw_date) && $raw_date > 40000 && $raw_date < 60000) {
    $excel_base = strtotime('1899-12-30'); // Excel epoch
    $timestamp = $excel_base + ($raw_date * 86400);
    $formatted_date = date('d/m/Y', $timestamp);
}

// 2. Handle DateTime object
elseif ($raw_date instanceof DateTime) {
    $formatted_date = $raw_date->format('d/m/Y');
}

// 3. Handle string formats
elseif (is_string($raw_date)) {
    $known_formats = ['Y-m-d', 'd.m.Y', 'd/m/Y'];
    foreach ($known_formats as $format) {
        $dt = DateTime::createFromFormat($format, $raw_date);
        if ($dt && $dt->format($format) === $raw_date) {
            $formatted_date = $dt->format('d/m/Y');
            break;
        }
    }

    if (!$formatted_date) {
        $timestamp = strtotime($raw_date);
        if ($timestamp) {
           
            $formatted_date = date('d/m/Y', $timestamp);
        }
    }
}

echo '<td>' . esc_html($formatted_date) . '</td>';




// 	$tidsvindu = get_field('tidsvindu_for_levering', $post_id);
// if ($tidsvindu === '' || $tidsvindu === 'Kontakt kunde') {
//     $tidsvindu = '6:00 - 6:05';
// }
// echo '<td>' . esc_html($tidsvindu) . '</td>';
// 
// 
// Start with saved time window
$tidsvindu = get_field('tidsvindu_for_levering', $post_id);

// Manual override fields
$fra = get_field('field_68c96a6e01ff4', $post_id);
if ($fra === null) { $fra = get_field('endre_tid_fra', $post_id); }

$til = get_field('field_68c96db7722ba', $post_id);
if ($til === null) { $til = get_field('endre_tid_til', $post_id); }

$fra = is_string($fra) ? trim($fra) : '';
$til = is_string($til) ? trim($til) : '';

$has_manual = ($fra !== '' && $til !== '' && $fra !== '00:00' && $til !== '00:00');

if ($has_manual) {
    // Always override, including when admin selected “Kontakt kunde”
    $tidsvindu = $fra . ' - ' . $til;
} else {
    // No override → fallback if empty or “Kontakt kunde”
    $is_kontakt = is_string($tidsvindu) && strcasecmp(trim($tidsvindu), 'Kontakt kunde') === 0;
    if ($tidsvindu === '' || $is_kontakt) {
        $tidsvindu = '6:00 - 6:05';
    }
}

echo '<td>' . esc_html($tidsvindu) . '</td>';


	echo '<td>' . esc_html(get_the_author_meta('display_name', get_post_field('post_author', $post_id))) . '</td>';
        echo '<td>' . esc_html(get_field('bestillingsnr', $post_id)) . '</td>';
        echo '<td>' . esc_html(get_field('kundens_navn', $post_id)) . '</td>';
     
	
	//TELEPHONE WITHOUT COUNTRY CODE TEMPORARY!!!
	//
	//
	//
	 //$full_phone = get_field('telefon_full', $post_id);
	 $full_phone = get_field('telefon', $post_id);

	
	
	
$fallback_phone = get_field('telefon', $post_id);
echo '<td>' . esc_html($full_phone ?: $fallback_phone) . '</td>';

//
//
//
//
	


       
        echo '<td>' . esc_html(get_field('pickup_address', $post_id)) . '</td>';
        $extra_pickups = get_field('extra_pickup_locations', $post_id);

if (!empty($extra_pickups) && is_array($extra_pickups)) {
    $pickup_list = array_map(function($row) {
        return trim($row['pickup'] ?? '');
    }, $extra_pickups);

    echo '<td>' . esc_html(implode(', ', array_filter($pickup_list))) . '</td>';
} else {
    echo '<td></td>';
}

	echo '<td>' . esc_html(get_field('delivery_address', $post_id)) . '</td>';
	echo '<td>' . esc_html(get_field('returadresse', $post_id)) . '</td>';
	echo '<td>' . esc_html(implode(', ', $products_list)) . '</td>';

/* -------------------------------------------
 * Leveringstype column: aggregate from ALL product rows (both layouts)
 * using explicit ACF keys you provided + safe name fallbacks.
 * Cleans labels like "669:Innbæring:INDOOR" → "Innbæring".
 * ------------------------------------------- */

// 0) Helpers
$__otman_clean_lev_label = static function($s): string {
    $s = is_string($s) ? trim($s) : '';
    if ($s === '') return '';

    // A) Strip trailing " (CODE)"
    if (preg_match('/^(.*?)\s*\(([^)]+)\)\s*$/u', $s, $m)) {
        $s = trim($m[1]);
    }

    // B) Handle "price:Label:CODE" or "price:Label" or "Label:CODE"
    $parts = array_map('trim', explode(':', $s));
    if (count($parts) >= 3 && $parts[1] !== '') {
        // <price> : <Label> : <CODE>
        $s = $parts[1];
    } elseif (count($parts) === 2) {
        // Either "<price> : <Label>" or "<Label> : <CODE>"
        $maybePrice = str_replace([' ', '.', ','], '', $parts[0]);
        if ($maybePrice !== '' && ctype_digit($maybePrice)) {
            $s = $parts[1]; // price : label
        } else {
            $s = $parts[0]; // label : code
        }
    } else {
        $s = $parts[0];
    }

    // Final tidy
    $s = preg_replace('/\s+/u', ' ', $s);
    return trim($s);
};

$__otman_labels_from_obj = static function($obj) use ($__otman_clean_lev_label): array {
    if (!$obj || !array_key_exists('value', $obj)) return [];
    $val     = $obj['value'];
    $choices = is_array($obj['choices'] ?? null) ? $obj['choices'] : [];

    $push = static function($v) use ($choices, $__otman_clean_lev_label): ?string {
        if ($v === null || $v === false || $v === '') return null;
        $raw = isset($choices[$v]) && $choices[$v] !== '' ? $choices[$v] : (is_string($v) ? $v : '');
        $lab = $__otman_clean_lev_label($raw);
        return $lab !== '' ? $lab : null;
    };

    $out = [];
    if (is_array($val)) {
        foreach ($val as $v) { $lab = $push($v); if ($lab) $out[] = $lab; }
    } else {
        $lab = $push($val); if ($lab) $out[] = $lab;
    }
    return $out;
};

// 1) Gather leveringstype from EVERY Flexible Content row
$lev_accum = [];
$flex_key  = 'field_682b0fa395c44'; // your flexible content field

// Explicit sub-field KEYS you provided for “Velg leveringstype”
$leveringstype_keys = [
  'field_681b162239347',
  'field_6880e6834088b',
  'field_68246df488e9a',
  'field_68235e7826058',
  'field_682b100495c6b',
  'field_6880eb12e3933',
  'field_682b102595c6c',
  'field_682b103d95c6d',
];

// Also try common *names* in case a layout references by name
$leveringstype_names = [
  'velg_leveringstype',
  'leveringstype',
  'delivery_type',
];

if (have_rows($flex_key, $post_id)) {
    while (have_rows($flex_key, $post_id)) { the_row();

        // Try by KEY first
        foreach ($leveringstype_keys as $k) {
            $obj = get_sub_field_object($k);
            if (!$obj) continue;

            // Only accept if the field really is a Leveringstype selector
            $label_txt = strtolower(trim((string)($obj['label'] ?? '')));
            if ($label_txt !== '' && strpos($label_txt, 'leveringstype') === false) {
                continue;
            }

            $lev_accum = array_merge($lev_accum, $__otman_labels_from_obj($obj));
        }

        // Then try by NAME
        foreach ($leveringstype_names as $nm) {
            $obj = get_sub_field_object($nm);
            if (!$obj) continue;

            $label_txt = strtolower(trim((string)($obj['label'] ?? '')));
            $is_lstype = $label_txt === '' ? true : (strpos($label_txt, 'leveringstype') !== false);

            if ($is_lstype) {
                $lev_accum = array_merge($lev_accum, $__otman_labels_from_obj($obj));
            }
        }
    }
}

// 2) Optional: also include a top-level Leveringstype (if any)
$top_candidates = [
  'field_681b162239347', // in case one of these is top-level somewhere
  'field_6880e6834088b',
  'leveringstype',
  'velg_leveringstype',
  'delivery_type',
];
foreach ($top_candidates as $cand) {
    $obj = get_field_object($cand, $post_id);
    if ($obj) {
        $lev_accum = array_merge($lev_accum, $__otman_labels_from_obj($obj));
    }
}

// 3) Fallback: if still nothing in ACF, parse price_breakdown_html (optional)
if (!$lev_accum) {
    $delivery_labels_fallback = [];

    if (!empty($price_html)) {
        libxml_use_internal_errors(true);
        $doc = new DOMDocument();
        $doc->loadHTML('<?xml encoding="UTF-8">' . $price_html);
        libxml_clear_errors();
        $xpath = new DOMXPath($doc);

        // If leveringstype is ever pushed into the breakdown with a code:
        $DELIVERY_TYPE_CODES = [
          'SIDEBYSIDETRAPP','SIDEBYSIDE','DELIVERY','INDOOR','XTRA',
          'INSSBS1','INSSBS2','INSTALLONLY','KUNMONTERING'
        ];

        $rows = $xpath->query('//span[contains(@class,"price-breakdown-label")]');
        foreach ($rows as $row) {
            $text = trim($row->textContent);

            if (preg_match('/^(.*?)\s*\(([^)]+)\)$/u', $text, $m)) {
                $label = $__otman_clean_lev_label($m[1]);
                $code  = strtoupper(trim($m[2]));
                if ($label !== '' && in_array($code, $DELIVERY_TYPE_CODES, true)) {
                    $delivery_labels_fallback[] = $label;
                    continue;
                }
            }

            // Pure text fallback if no code but clearly install-only
            if (preg_match('/kun\s+installasjon|kun\s+installasjon\/?montering|kun\s+montering/i', $text)) {
                $delivery_labels_fallback[] = 'Kun Installasjon/Montering';
            }
        }
    }

    $lev_accum = $delivery_labels_fallback;
}

// 4) Render the column (deduped, human-friendly)
$lev_accum = array_values(array_unique(array_filter(array_map('trim', $lev_accum))));
echo '<td>' . esc_html(implode(', ', $lev_accum)) . '</td>';
	
	
	// Load Overflattype fields
$overflattype_fields = [
    'field_688cc6369eb99',
    'field_688cc9afda99b',
    'field_688cc7d3714dd',
    'field_688cc89d6eb49',
];

$overflattype_values = [];

if (have_rows('field_682b0fa395c44', $post_id)) {
    while (have_rows('field_682b0fa395c44', $post_id)) {
        the_row();
        foreach ($overflattype_fields as $field_key) {
            $val = get_sub_field($field_key);
            if (!empty($val)) {
                if (is_array($val)) {
                    foreach ($val as $v) {
                        $v = trim($v);
                        if ($v !== '') $overflattype_values[] = $v;
                    }
                } else {
                    $val = trim($val);
                    if ($val !== '') $overflattype_values[] = $val;
                }
            }
        }
    }
}

// Combine "Montering" items and "Overflattype" values
$montering_output = $other_services;

if (!empty($overflattype_values)) {
    $montering_output[] = 'Overflattype: ' . implode(', ', array_unique($overflattype_values));
}

echo '<td>' . esc_html(implode(', ', $montering_output)) . '</td>';

	
	echo '<td>' . esc_html(get_field('beskrivelse', $post_id)) . '</td>';
	echo '<td>' . esc_html(get_field('kasserers_navn', $post_id)) . '</td>';
	
	$kass_telefon = get_field('kasserers_telefon_full', $post_id) ?: get_field('kasserers_telefon', $post_id);
echo '<td>' . esc_html($kass_telefon) . '</td>';
$notes = get_field('contact_notes', $post_id);
	$drivernotes = get_field('info_til_sjaforen', $post_id);
$heis  = get_field('heis', $post_id);
$etasje = get_field('etasje_nr', $post_id);
$ekstratelefon_raw = get_field('ekstra_kundens_telefon', $post_id);
$ekstratelefon = preg_replace('/\D+/', '', $ekstratelefon_raw); // strip non-digits
if (strlen($ekstratelefon) < 6) $ekstratelefon = ''; // skip if too short

$extra = [];
	if ($notes !== '') $extra[] = '<b>Kundenotater:</b> ' . $notes;
if ($heis) $extra[] = '<b>Heis:</b> JA';
if ($etasje !== '') $extra[] = '<b>Etasje:</b> ' . $etasje;

if ($ekstratelefon !== '') $extra[] = '<b>Ekstra kundens telefon:</b> ' . $ekstratelefon;
// $drivernotes comes from ACF (text/textarea/WYSIWYG)
$raw = (string) $drivernotes;

// Strip tags, decode entities (turn &nbsp; into a real space), remove non-breaking spaces,
// collapse whitespace, then trim.
$clean = trim(preg_replace('/\s+/u', ' ',
          preg_replace('/\xC2\xA0|\x{00A0}/u', ' ',
          html_entity_decode(wp_strip_all_tags($raw), ENT_QUOTES | ENT_HTML5, 'UTF-8'))));

if ($clean !== '') {
    $extra[] = '<b>Info til sjaforen:</b> ' . $clean; // or 'sjåføren' if you prefer
}

/* === NEW: include status_notes ACF field === */
$status_raw = (string) get_field('status_notes', isset($post_id) ? $post_id : get_the_ID());
$status_notes_clean = trim(preg_replace('/\s+/u', ' ',
                        preg_replace('/\xC2\xA0|\x{00A0}/u', ' ',
                        html_entity_decode(wp_strip_all_tags($status_raw), ENT_QUOTES | ENT_HTML5, 'UTF-8'))));
if ($status_notes_clean !== '') {
    $extra[] = '<b>Status-notater: </b>' . $status_notes_clean;
}
/* === END NEW === */

// $combined = trim(  ($extra ? ' — ' . implode(', ', $extra) : ''));
echo '<td>' . implode('  ', $extra) . '</td>';


// 	echo '<td>' . esc_html(get_field('driver', $post_id)) . '</td>';
// echo '<td>' . esc_html(get_field('ekstra_driver', $post_id)) . '</td>';

	

// Combine Driver, Driver 2, Bilskilt, and Subcontractor into one column
$driver  = trim((string) get_field('driver', $post_id));
	$driver1  = trim((string) get_field('driver1', $post_id));
$driver2 = trim((string) get_field('ekstra_driver', $post_id));
	$driver3 = trim((string) get_field('driver2', $post_id));
$plate   = trim((string) get_field('bilskilt', $post_id));
	$plate2   = trim((string) get_field('bilskilt1', $post_id));
$subcontractor = trim((string) get_field('subcontractor', $post_id));
	$drivernotes = trim((string) get_field('driver_notes', $post_id));

$parts = [];
if (valid_text($driver))        $parts[] = '<b>Driver:</b> ' . $driver;
if (valid_text($driver1))       $parts[] = '<b>Driver:</b> ' . $driver1;
if (valid_text($driver2))       $parts[] = '<b>Driver 2:</b> ' . $driver2;
if (valid_text($driver3))       $parts[] = '<b>Driver 2:</b> ' . $driver3;
if (valid_text($plate))         $parts[] = '<b>Bilskilt:</b> ' . $plate;
if (valid_text($plate2))        $parts[] = '<b>Bilskilt:</b> ' . $plate2;
if (valid_text($subcontractor)) $parts[] = '<b>Subcontractor:</b> ' . $subcontractor;
if (valid_text($drivernotes))  $parts[] = '<b>Driver notes:</b>' . $drivernotes;
echo '<td>' . implode('  ', $parts) . '</td>';

	
	echo '<td>' . esc_html( get_the_date( 'd/m/Y H:i', $post_id ) ) . '</td>';
// echo '<td>' . esc_html( get_the_modified_date( 'd/m/Y H:i', $post_id ) ) . '</td>';
// 
$last_editor = otman_get_last_editor_name($post_id); // uses the helper above
$modified_at = get_the_modified_date('d/m/Y H:i', $post_id);

echo '<td>' . esc_html($modified_at);
if ($last_editor !== '') {
    // Show “by <name>” on a new line, smaller text
    echo '<br><small>av ' . esc_html($last_editor) . '</small>';
}
echo '</td>';


	echo '<td>' . esc_html(get_field('total_price', $post_id)) . '</td>';
	$sub_amount = 0;
$sub_html = get_field('price_breakdown_subcontractor_html', $post_id);

if (!empty($sub_html)) {
    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    $doc->loadHTML('<?xml encoding="utf-8" ?>' . $sub_html);
    libxml_clear_errors();
    $xpath = new DOMXPath($doc);

    $rows = $xpath->query('//div[contains(@class,"price-breakdown-row")]');
    foreach ($rows as $row) {
        $labelNode = $xpath->query('.//span[contains(@class,"price-breakdown-label")]', $row)->item(0);
        $priceNode = $xpath->query('.//span[contains(@class,"price-breakdown-price")]', $row)->item(0);

        if ($labelNode && stripos($labelNode->textContent, 'Total') !== false && $priceNode) {
          if (preg_match('/(-?\d+(?:\s\d{3})*)([.,]\d+)?\s*NOK/i', $priceNode->textContent, $m)) {

    // Combine integer + decimal part
    $num = $m[1] . ($m[2] ?? '');

    // Normalize:
    // remove spaces, convert comma to dot
    $clean = str_replace([' ', ','], ['', '.'], $num);

    // Convert to float
    $sub_amount = (float) $clean;

    break;
}


        }
    }
}
echo '<td>' . $sub_amount . '</td>';



        echo '</tr>';
    endwhile;

    echo '</tbody></table>';
    wp_reset_postdata();

    wp_send_json([
        'html' => ob_get_clean(),
        'max_pages' => $max_pages
    ]);
});



add_filter('comments_open', '__return_false', 20, 2);


add_action('wp_ajax_bulk_update_order_status', function () {
  if (!is_user_logged_in()) {
    wp_send_json_error(['message' => 'Not logged in']);
  }

  $status = sanitize_text_field($_POST['status'] ?? '');
  $ids    = json_decode(stripslashes($_POST['post_ids'] ?? '[]'), true);

  if ($status === '' || !is_array($ids) || !$ids) {
    wp_send_json_error(['message' => 'Invalid input (need a status and some IDs)']);
  }

  // Ensure wipe helpers exist (same as before)
  if (!function_exists('otman_gdpr_wipe_on_paid')) {
    @require_once WP_PLUGIN_DIR . '/otman-gdpr/otman-gdpr-paid-wipe.php';
  }
  if (!function_exists('otman_gdpr_wipe_raw')) {
    function otman_gdpr_wipe_raw(int $post_id): void {
      if (get_post_type($post_id) !== 'power_order') return;
      if (get_post_meta($post_id, '_gdpr_erased_on_paid', true)) return;

      $fields = [
        'kundens_navn','pickup_address','delivery_address','returadresse',
        'e-postadresse','kasserers_telefon',
        'telefon','telefon_full','kasserers_telefon_full',
        'contact_notes','info_til_sjaforen','extra_pickup_locations',
      ];

      foreach ($fields as $name) {
        delete_post_meta($post_id, $name);
        delete_post_meta($post_id, '_'.$name);
        update_post_meta($post_id, $name, '');
      }

      global $wpdb;
      $wpdb->query(
        $wpdb->prepare(
          "DELETE FROM {$wpdb->postmeta} WHERE post_id=%d AND meta_key LIKE %s",
          $post_id,
          $wpdb->esc_like('extra_pickup_locations_') . '%'
        )
      );

      update_post_meta($post_id, '_gdpr_erased_on_paid', current_time('mysql'));
      if (is_user_logged_in()) update_post_meta($post_id, '_gdpr_erased_by', get_current_user_id());
      clean_post_cache($post_id);
    }
  }

  $uid = get_current_user_id();
  $updated = 0;

  wp_defer_term_counting(true);
  wp_defer_comment_counting(true);

  foreach ($ids as $raw) {
    $post_id = (int) $raw;
    if ($post_id <= 0 || get_post_type($post_id) !== 'power_order') continue;

    // 1) Set requested status (not only Paid)
    update_post_meta($post_id, 'status', $status);

    // 2) If becoming Paid → wipe
    if ($status === 'Betalt') {
      if (function_exists('otman_gdpr_wipe_on_paid')) {
        otman_gdpr_wipe_on_paid($post_id);
      }
      otman_gdpr_wipe_raw($post_id);
      do_action('otman/gdpr_wipe_on_paid', $post_id);
    }

    // 3) Bookkeeping
    update_post_meta($post_id, '_edit_last', $uid);
    wp_update_post([
      'ID'                => $post_id,
      'post_modified'     => current_time('mysql'),
      'post_modified_gmt' => current_time('mysql', true),
    ]);

    $updated++;
  }

  wp_defer_term_counting(false);
  wp_defer_comment_counting(false);

  wp_send_json_success(['updated' => $updated, 'paid' => ($status === 'Betalt') ? 1 : 0]);
});


add_action('wp_ajax_bulk_duplicate_orders', function () {
    // Let any logged-in user with 'read' (includes subscribers) duplicate
    if ( ! is_user_logged_in() || ! current_user_can('read') ) {
        wp_send_json_error(['message' => 'Ingen tilgang.']);
    }

    $ids = json_decode(stripslashes($_POST['post_ids'] ?? '[]'), true);
    if ( ! is_array($ids) || empty($ids) ) {
        wp_send_json_error(['message' => 'Ingen ID-er mottatt.']);
    }

    $new_ids = [];
    foreach ($ids as $orig_id) {
        $new_id = otman_duplicate_power_order((int) $orig_id);
        if ($new_id) $new_ids[] = $new_id;
    }

    wp_send_json_success(['new_ids' => $new_ids]);
});

add_action('wp_ajax_bulk_send_to_gsm', function () {
  if ( ! is_user_logged_in() ) {
    wp_send_json_error(['message' => 'Not logged in']);
  }


  $nonce = sanitize_text_field($_POST['nonce'] ?? '');
  if ( ! wp_verify_nonce($nonce, 'otman_gsm_bulk') ) {
    wp_send_json_error(['message' => 'Ugyldig forespørsel (nonce)']);
  }

  $ids = json_decode(stripslashes($_POST['post_ids'] ?? '[]'), true);
  if ( ! is_array($ids) || ! $ids ) {
    wp_send_json_error(['message' => 'Ingen ID-er mottatt']);
  }

  if ( ! function_exists('otman_gsm_push_order_from_post') ) {
    wp_send_json_error(['message' => 'GSM sender mangler (otman_gsm_push_order_from_post)']);
  }

  $results = [];
  foreach ($ids as $raw) {
    $post_id = (int) $raw;
    if ($post_id <= 0 || get_post_type($post_id) !== 'power_order') {
      $results[] = ['post_id'=>$post_id, 'ok'=>false, 'http'=>0, 'gsm_id'=>null, 'msg'=>'Ugyldig bestilling'];
      continue;
    }

    // Call your existing push function (which builds tasks from ACF)
    $resp = otman_gsm_push_order_from_post($post_id);

    if (is_wp_error($resp)) {
      $results[] = [
        'post_id' => $post_id,
        'ok'      => false,
        'http'    => 0,
        'gsm_id'  => null,
        'msg'     => $resp->get_error_message()
      ];
      continue;
    }

    $http   = (int) ($resp['code'] ?? 0);
    $gsm_id = null;
    $msg    = '';

    // Try to read back GSM order id / error message
    $body = $resp['response'] ?? [];
    if (is_array($body)) {
      // order created → often returns an "order" array/object (API-dependent)
      if (!empty($body['order']['id'])) {
        $gsm_id = $body['order']['id'];
      } elseif (!empty($body['id'])) {
        $gsm_id = $body['id'];
      }
      if (!empty($body['detail'])) $msg = (string) $body['detail'];
      if (!$msg && !empty($body['message'])) $msg = (string) $body['message'];
    }

    $ok = ($http >= 200 && $http < 300);

    $results[] = [
      'post_id' => $post_id,
      'ok'      => $ok,
      'http'    => $http,
      'gsm_id'  => $gsm_id ?: null,
      'msg'     => $msg
    ];
  }

  wp_send_json_success([
    'sent'    => count($results),
    'results' => $results
  ]);
});

add_action('wp_ajax_bulk_update_order_driver_text', function () {
  if (!is_user_logged_in()) {
    wp_send_json_error(['message' => 'Not logged in']);
  }

  $driver = sanitize_text_field($_POST['driver'] ?? '');
  $ids    = json_decode(stripslashes($_POST['post_ids'] ?? '[]'), true);
  if ($driver === '' || !is_array($ids) || empty($ids)) {
    wp_send_json_error(['message' => 'Ugyldig input (trenger sjåførnavn og ID-er).']);
  }

  $updated = 0;
  $uid = get_current_user_id();

  wp_defer_term_counting(true);
  wp_defer_comment_counting(true);

  foreach ($ids as $raw) {
    $post_id = (int) $raw;
    if ($post_id <= 0 || get_post_type($post_id) !== 'power_order') continue;

    // ✅ Write using FIELD KEY so ACF UI sees it
    if (function_exists('update_field')) {
      update_field('field_690b2189b30e4', $driver, $post_id);
    } else {
      // Fallback: set both value and reference (ACF underscore meta)
      update_post_meta($post_id, 'driver', $driver);
      update_post_meta($post_id, '_driver', 'field_690b2189b30e4');
    }

    // bump editor + modified timestamp
    update_post_meta($post_id, '_edit_last', $uid);
    wp_update_post([
      'ID'                => $post_id,
      'post_modified'     => current_time('mysql'),
      'post_modified_gmt' => current_time('mysql', true),
    ]);

    // clear caches so the form loads fresh
    if (function_exists('acf_flush_value_cache')) acf_flush_value_cache($post_id);
    clean_post_cache($post_id);
    wp_cache_delete($post_id, 'post_meta');

    $updated++;
  }

  wp_defer_term_counting(false);
  wp_defer_comment_counting(false);

  wp_send_json_success(['updated' => $updated]);
});


add_action('wp_ajax_bulk_update_order_subcontractor', function () {
  if (!is_user_logged_in()) {
    wp_send_json_error(['message' => 'Not logged in']);
  }

  $sub = sanitize_text_field($_POST['subcontractor'] ?? '');
  $ids = json_decode(stripslashes($_POST['post_ids'] ?? '[]'), true);

  if ($sub === '' || !is_array($ids) || empty($ids)) {
    wp_send_json_error(['message' => 'Ugyldig input (trenger subcontractor og ID-er).']);
  }

  $updated = 0;
  $uid = get_current_user_id();

  wp_defer_term_counting(true);
  wp_defer_comment_counting(true);

  foreach ($ids as $raw) {
    $post_id = (int) $raw;
    if ($post_id <= 0 || get_post_type($post_id) !== 'power_order') continue;

    update_post_meta($post_id, 'subcontractor', $sub);

    // mirror your "last editor" & bump modified like other handlers
    update_post_meta($post_id, '_edit_last', $uid);
    wp_update_post([
      'ID'                => $post_id,
      'post_modified'     => current_time('mysql'),
      'post_modified_gmt' => current_time('mysql', true),
    ]);

    $updated++;
  }

  wp_defer_term_counting(false);
  wp_defer_comment_counting(false);

  wp_send_json_success(['updated' => $updated]);
});


/**
 * Duplicate a power_order with all custom fields/meta.

 */
function otman_duplicate_power_order( int $orig_id ): int {
    $orig = get_post($orig_id);
    if ( ! $orig || $orig->post_type !== 'power_order' ) return 0;

    $new_postarr = [
        'post_type'    => 'power_order',
        'post_status'  => 'publish',
        'post_author'  => $orig->post_author, // or get_current_user_id() if you prefer
        'post_title'   => ($orig->post_title ?: 'Bestilling') . ' (kopi)',
        'post_content' => $orig->post_content,
        'post_excerpt' => $orig->post_excerpt,
    ];
    $new_id = wp_insert_post($new_postarr, true);
    if ( is_wp_error($new_id) || ! $new_id ) return 0;

    $blacklist = ['_edit_lock','_edit_last','_wp_old_slug','_thumbnail_id','slug_numeric_id'];
    $all_meta = get_post_meta($orig_id);

    foreach ($all_meta as $key => $values) {
        if (in_array($key, $blacklist, true)) continue;

        // Keep your other resets
        if ($key === 'status')         { update_post_meta($new_id, $key, 'Behandles'); continue; }
//         if ($key === 'bestillingsnr')  { update_post_meta($new_id, $key, '');         continue; }

       
        foreach ($values as $v) {
            update_post_meta($new_id, $key, maybe_unserialize($v));
        }
    }

    // (Optional) if you want to be explicit about dates:
    $ld  = get_post_meta($orig_id, 'leveringsdato', true);
    $lds = get_post_meta($orig_id, 'leveringsdato_sortable', true);
    if ($ld  !== '') update_post_meta($new_id, 'leveringsdato', $ld);
    if ($lds !== '') update_post_meta($new_id, 'leveringsdato_sortable', $lds);

    return $new_id;
}





add_action('save_post_power_order', function ($post_id) {
  $slug = get_post_field('post_name', $post_id);
  if (preg_match('/(\d+)$/', $slug, $m)) {
    update_post_meta($post_id, 'slug_numeric_id', $m[1]);
  }
});



// Bridge endpoint so FEA can render with full head/footer when the inline shortcode returns empty.
add_action('template_redirect', function () {
    if ( isset($_GET['power-fea']) && $_GET['power-fea'] === '1' ) {
        $pid = intval($_GET['post_id'] ?? 0);

        // Standard page chrome so scripts/styles enqueue correctly
        status_header(200);
        nocache_headers();
        ?>
        <!doctype html>
        <html <?php language_attributes(); ?>>
        <head>
            <meta charset="<?php bloginfo('charset'); ?>">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <?php wp_head(); ?>
            <style>
                html,body{margin:0;padding:10px;background:#fff}
                .acf-form{max-width:100%;} /* keep it neat inside iframe */
				
            </style>
        </head>
		

        <body class="power-fea-iframe">
            <?php
            // Same form + post_id as inline
            echo do_shortcode('[frontend_admin form="7599" post_id="' . $pid . '"]');
            ?>
            <?php wp_footer(); ?>
        </body>
        </html>
        <?php
        exit;
    }
});


// When ACF Frontend/Admin saves a power_order, set last editor and bump modified time.
add_action('acf/save_post', function ($post_id) {
    if (!is_user_logged_in()) return;

    // Normalize post_id (ACF may pass "post_123")
    if (is_string($post_id) && strpos($post_id, 'post_') === 0) {
        $post_id = (int) substr($post_id, 5);
    }
    $post_id = (int) $post_id;
    if ($post_id <= 0) return;
    if (get_post_type($post_id) !== 'power_order') return;
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;

    // Set "last edited by"
    update_post_meta($post_id, '_edit_last', get_current_user_id());

    // Bump modified timestamps (guard against recursion)
    static $touching = false;
    if ($touching) return;
    $touching = true;
    wp_update_post([
        'ID'                => $post_id,
        'post_modified'     => current_time('mysql'),
        'post_modified_gmt' => current_time('mysql', true),
    ]);
    $touching = false;
}, 50);

// Safety net for any normal WP saves of power_order
add_action('save_post_power_order', function ($post_id, $post, $update) {
    if (!is_user_logged_in() || defined('DOING_AUTOSAVE')) return;
    update_post_meta($post_id, '_edit_last', get_current_user_id());
}, 20, 3);

add_filter('acf/load_field/key=field_681b15bf298b6', function ($field) {
    if (!is_user_logged_in()) return $field;

    $user = wp_get_current_user();
    

    // Keep OsloKontorMobler legacy behavior
    if ($user->user_login === 'OsloKontorMobler') {
        foreach ($field['choices'] as $value => $label) {
            if (
                stripos(trim((string)$value), 'timepris') !== false ||
                stripos(trim((string)$label), 'timepris') !== false
            ) {
                $field['choices'] = [$value => $label];
                return $field;
            }
        }
        return $field;
    }

    $allowed = get_field('allowed_products', 'user_' . $user->ID);
    if (empty($allowed) || !is_array($allowed)) return $field;

    $allowed_norm = array_map(function ($item) {
        return strtolower(trim((string)$item));
    }, $allowed);

    $filtered_choices = [];

    foreach ($field['choices'] as $value => $label) {
        $value_norm = strtolower(trim((string)$value));
        $label_norm = strtolower(trim((string)$label));

        $is_allowed =
            in_array($value_norm, $allowed_norm, true) ||
            in_array($label_norm, $allowed_norm, true);

        // legacy fallback for old Timepris
        if (
            !$is_allowed &&
            in_array('timepris', $allowed_norm, true) &&
            (stripos($value_norm, 'timepris') !== false || stripos($label_norm, 'timepris') !== false)
        ) {
            $is_allowed = true;
        }

        if ($is_allowed) {
            $filtered_choices[$value] = $label;
        }
    }

    if (!empty($filtered_choices)) {
        $field['choices'] = $filtered_choices;
    }

    return $field;
});

add_filter('acf/prepare_field/key=field_690886f3b67da', function ($field) {
    if (!is_user_logged_in()) return $field;

    $user_id = get_current_user_id();
    $allowed = get_field('allowed_products', 'user_' . $user_id);

    if (empty($allowed) || !is_array($allowed)) {
        return $field;
    }

    $allowed = array_map('trim', $allowed);

    $allowed_norm = array_map(function ($item) {
    return strtolower(trim((string)$item));
}, $allowed);

$has_timepris = false;

foreach ($allowed_norm as $item) {
    if (
        stripos($item, 'timepris') !== false ||
        stripos($item, 'timepris_flugger') !== false ||
        stripos($item, 'timepris flugger') !== false
    ) {
        $has_timepris = true;
        break;
    }
}

if (!$has_timepris) {
    return false;
}

    return $field;
});

add_filter('acf/load_field/key=field_682b0fe895c6a', function ($field) {
    if (!is_user_logged_in()) {
        return $field;
    }

    $user = wp_get_current_user();
    $name = function_exists('mb_strtolower')
        ? mb_strtolower(trim($user->display_name))
        : strtolower(trim($user->display_name));

    // Flugger 028
    if (strpos($name, 'flugger 028') !== false) {
        $field['choices'] = [
            '750:Pall:PALLS1'   => 'Pall',
            'Kasse levering'   => 'Kasse levering',
            'timepris_flugger' => 'Timepris Flugger',
        ];
        return $field;
    }

    // Banor
    if (strpos($name, 'banor transport as') !== false) {
        $field['choices'] = [
            '750:Pall:PALLS1' => 'Pall',
        ];
        return $field;
    }

    return $field;
}, 999);

// add_action('acf/save_post', function ($post_id) {
//     // Normalize post_id from ACF
//     if (is_string($post_id) && strpos($post_id, 'post_') === 0) {
//         $post_id = (int) substr($post_id, 5);
//     }

//     $post_id = (int) $post_id;
//     if ($post_id <= 0) return;
//     if (get_post_type($post_id) !== 'power_order') return;
//     if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;

//     $post = get_post($post_id);
//     if (!$post) return;
//     if ($post->post_status !== 'publish') return;

//     $author_id = (int) $post->post_author;
//     if ($author_id <= 0) return;

//     // Collect postmeta, skip ACF/internal helper keys that start with "_"
//     $all_meta = get_post_meta($post_id);
//     $meta = [];

//     foreach ($all_meta as $key => $values) {
//         if (strpos($key, '_') === 0) continue;

//         if (!is_array($values) || count($values) === 0) {
//             $meta[$key] = null;
//             continue;
//         }

//         $meta[$key] = maybe_unserialize($values[0]);
//     }

//     $payload = [
//         'legacyWordpressOrderId' => $post_id,
//         'legacyWordpressUserId'  => $author_id,
//         'createdAt'              => $post->post_date,
//         'status'                 => get_post_meta($post_id, 'status', true) ?: $post->post_status,
//         'title'                  => $post->post_title,
//         'meta'                   => $meta,
//     ];

//     $response = wp_remote_post('https://otman.onrender.com/api/integrations/wordpress/orders', [
//         'timeout' => 20,
//         'headers' => [
//             'Content-Type'     => 'application/json',
//             'x-wp-sync-secret' => 'asfasfasfuasytfoi21t3uioy12t3iu21ytobastfaosuftaszxc',
//         ],
//         'body' => wp_json_encode($payload),
//     ]);

//     if (is_wp_error($response)) {
//         error_log('WP order sync failed for post ' . $post_id . ': ' . $response->get_error_message());
//         return;
//     }

//     $code = wp_remote_retrieve_response_code($response);
//     if ($code < 200 || $code >= 300) {
//         error_log(
//             'WP order sync failed for post ' . $post_id .
//             ': HTTP ' . $code .
//             ' body=' . wp_remote_retrieve_body($response)
//         );
//     }
// }, 200);

if (!function_exists('otman_queue_power_order_sync')) {
    function otman_queue_power_order_sync($post_id) {
        $post_id = (int) $post_id;
        if ($post_id <= 0) return;

        if (
            !isset($GLOBALS['otman_power_order_sync_queue']) ||
            !is_array($GLOBALS['otman_power_order_sync_queue'])
        ) {
            $GLOBALS['otman_power_order_sync_queue'] = [];
        }

        $GLOBALS['otman_power_order_sync_queue'][$post_id] = true;
    }
}

if (!function_exists('otman_send_power_order_sync')) {
    function otman_send_power_order_sync($post_id) {
        $post_id = (int) $post_id;
        if ($post_id <= 0) return;
        if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;

        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'power_order') return;
        if ($post->post_status !== 'publish') return;

        $author_id = (int) $post->post_author;
        if ($author_id <= 0) return;

        $all_meta = get_post_meta($post_id);
        $meta = [];

        foreach ($all_meta as $key => $values) {
            if (strpos($key, '_') === 0) continue;

            if (!is_array($values) || count($values) === 0) {
                $meta[$key] = null;
                continue;
            }

            $meta[$key] = maybe_unserialize($values[0]);
        }

        $payload = [
            'legacyWordpressOrderId' => $post_id,
            'legacyWordpressUserId'  => $author_id,
            'createdAt'              => $post->post_date,
            'status'                 => $meta['status'] ?? $post->post_status,
            'title'                  => $post->post_title,
            'meta'                   => $meta,
        ];

        $response = wp_remote_post('https://otman.onrender.com/api/integrations/wordpress/orders', [
            'timeout' => 20,
            'headers' => [
                'Content-Type'     => 'application/json',
                'x-wp-sync-secret' => 'asfasfasfuasytfoi21t3uioy12t3iu21ytobastfaosuftaszxc',
            ],
            'body' => wp_json_encode($payload),
        ]);

        if (is_wp_error($response)) {
            error_log('WP SYNC ERROR post_id=' . $post_id . ' msg=' . $response->get_error_message());
            return;
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        error_log('WP SYNC RESPONSE post_id=' . $post_id . ' code=' . $code . ' body=' . $body);
    }
}

add_action('shutdown', function () {
    $queue = $GLOBALS['otman_power_order_sync_queue'] ?? null;
    if (!is_array($queue) || count($queue) === 0) return;

    $post_ids = array_keys($queue);
    $GLOBALS['otman_power_order_sync_queue'] = [];

    foreach ($post_ids as $post_id) {
        otman_send_power_order_sync((int) $post_id);
    }
}, 999);

add_action('save_post_power_order', function ($post_id, $post, $update) {
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;
    if (!$post || $post->post_type !== 'power_order') return;
    if ($post->post_status !== 'publish') return;

    otman_queue_power_order_sync($post_id);
}, 200, 3);

add_action('acf/save_post', function ($post_id) {
    if (is_string($post_id) && strpos($post_id, 'post_') === 0) {
        $post_id = (int) substr($post_id, 5);
    }

    $post_id = (int) $post_id;
    if ($post_id <= 0) return;
    if (get_post_type($post_id) !== 'power_order') return;
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;

    otman_queue_power_order_sync($post_id);
}, 200);
