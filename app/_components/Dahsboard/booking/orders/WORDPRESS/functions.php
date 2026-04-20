<?php
/**
 * Theme functions and definitions.
 *
 * For additional information on potential customization options,
 * read the developers' documentation:
 *
 * https://developers.elementor.com/docs/hello-elementor-theme/
 *
 * @package HelloElementorChild
 */



if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

define( 'HELLO_ELEMENTOR_CHILD_VERSION', '2.0.0' );

/**
 * Load child theme scripts & styles.
 *
 * @return void
 */

require_once get_stylesheet_directory() . '/custom-functions.php';
require_once get_stylesheet_directory() . '/subcontractor-order-table.php';
require_once __DIR__ . '/otman-edit-request.php';
require_once __DIR__ . '/otman-bulk-mail.php';
require_once __DIR__ . '/includes/otman-gsm-bridge.php';
require_once __DIR__ . '/includes/otman-gsm-webhook-sync.php';
require_once __DIR__ . '/otman-gdpr-paid-wipe.php';
require_once __DIR__ . '/otman-chat.php';





function hello_elementor_child_scripts_styles() {
	wp_enqueue_style(
		'hello-elementor-child-style',
		get_stylesheet_directory_uri() . '/style.css',
		[
			'hello-elementor-theme-style',
		],
		HELLO_ELEMENTOR_CHILD_VERSION
	);
}
add_action('wp_enqueue_scripts', function() {
    wp_enqueue_script('jquery');
}, 1); // Priority 1: load early

function enqueue_intl_tel_input_assets() {
    wp_enqueue_style('intl-tel-input-css', 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/css/intlTelInput.css', [], '18.2.1');
    wp_enqueue_script('intl-tel-input-js', 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/intlTelInput.min.js', [], '18.2.1', true);
    wp_enqueue_script('intl-tel-utils', 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js', [], '18.2.1', true);
}
add_action('wp_enqueue_scripts', 'enqueue_intl_tel_input_assets');


add_action('wp_enqueue_scripts', function () {
    if (is_page('power-order-edit')) { // or use is_singular(), or check get_the_ID()
        acf_enqueue_scripts(); // This ensures acf-input.js and related assets are loaded
    }
});
add_action( 'wp_enqueue_scripts', 'hello_elementor_child_scripts_styles', 20 );

add_shortcode('acf_form_head_init', function () {
    ob_start();
    acf_form_head();
    return '';
});

add_action('wp_enqueue_scripts', function () {
  if (is_page('power-order-edit')) { // Replace with your correct page slug or condition
    acf_enqueue_scripts(); // This loads acf-input.js and dependencies
  }
});


function multilingual_shortcode() {
    if (function_exists('pll_current_language')) {
        $current_language = pll_current_language();

        if ($current_language == 'en') {
            return do_shortcode('[forminator_form id="1477"]');
        } elseif ($current_language == 'nn') {
            return do_shortcode('[forminator_form id="2565"]');
        }
    }
    return ''; // Return an empty string if the language is not recognized
}
add_shortcode('multilingual_shortcode', 'multilingual_shortcode');


add_action('after_setup_theme', 'remove_admin_bar_for_subscribers');
function remove_admin_bar_for_subscribers() {
    if (!current_user_can('manage_options')) {
        show_admin_bar(false);
    }
}

function load_jquery_script() {
    wp_enqueue_script('jquery');
}
add_action('wp_enqueue_scripts', 'load_jquery_script');


function enqueue_google_maps_api() {
    wp_enqueue_script(
        'google-maps-api',
        'https://maps.googleapis.com/maps/api/js?key=AIzaSyBhHzuSe0p92w-SpED90uOQxVycTMPjf44&libraries=places',
        null,
        null,
        true
    );
}
add_action('wp_enqueue_scripts', 'enqueue_google_maps_api');

///
//



// Catch fatal errors during AJAX (like Elementor editor) and log them manually
add_action('shutdown', function () {
  $error = error_get_last();
  if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
    $log_path = WP_CONTENT_DIR . '/elementor-ajax-crash.log';
    $msg = "[" . date('Y-m-d H:i:s') . "] " . $error['message'] . " in " . $error['file'] . " on line " . $error['line'] . "\n";
    file_put_contents($log_path, $msg, FILE_APPEND);
  }
});

//Save post author in CPT ACF
add_action('acf/save_post', 'set_current_user_as_author', 100);
function set_current_user_as_author($post_id) {
    // Only run for frontend admin forms
    if (defined('DOING_ACF_FORM') && DOING_ACF_FORM) {
        // Only set if it's a new post
        if (get_post_field('post_author', $post_id) == 0) {
            wp_update_post([
                'ID' => $post_id,
                'post_author' => get_current_user_id(),
            ]);
        }
    }
}

/**
 * Shortcode: [current_user_name]
 * Outputs the user's first and last name if available, otherwise display_name.
 */
// function current_user_name_shortcode() {
//     if ( ! is_user_logged_in() ) {
//         return '';
//     }

//     $user = wp_get_current_user();
//     $first = trim( get_user_meta( $user->ID, 'first_name', true ) );
//     $last  = trim( get_user_meta( $user->ID, 'last_name',  true ) );

//     // Build full name or fall back to display_name
//     if ( $first || $last ) {
//         $full_name = trim( "{$first} {$last}" );
//     } else {
//         $full_name = $user->display_name;
//     }

//     return esc_html( $full_name );
// }
// add_shortcode( 'current_user_name', 'current_user_name_shortcode' );


add_shortcode('current_user_name', function ($atts = []) {
    $a = shortcode_atts(['class' => 'sidebar-username', 'style' => ''], $atts, 'current_user_name');
    if (!is_user_logged_in()) return '';
    $u = wp_get_current_user();
    $name = $u->display_name ?: $u->user_login;
    return '<span class="'.esc_attr($a['class']).'" style="'.esc_attr($a['style']).'">'.esc_html($name).'</span>';
});




add_shortcode('frontend_admin_form_with_acf_head', function () {
    ob_start();
    acf_form_head(); // ✅ Inject required JS before rendering page
    echo do_shortcode('[frontend_admin form=5125]'); 
    return ob_get_clean();
});

add_action('template_redirect', function () {
    $current_user_id = get_current_user_id();

    // 1. Auto-logout if on /client-login and already logged in
    if (is_page('client-login') && is_user_logged_in()) {
        wp_logout();
        wp_redirect(home_url('/client-login'));
        exit;
    }

    // 2. Redirect non-logged-in users from these pages
    $protected_slugs = [
        'powerorder',
        'power-order-edit',
        'powerotman',
        'power-order-history',
        'personvern',
    ];

    if (!is_user_logged_in()) {
        foreach ($protected_slugs as $slug) {
            if (is_page($slug)) {
                wp_redirect(home_url('/client-login'));
                exit;
            }
        }

        // ⛔ Ensure non-logged-in users are also blocked from order-main-page
        if (is_page('order-main-page')) {
            wp_redirect(home_url('/client-login'));
            exit;
        }
    }

    // 3. Extra restriction: only user IDs 7, 4 can access order-main-page
    if (is_user_logged_in() && is_page('order-main-page')) {
        $allowed_ids = [7, 4, 3, 24, 25, 29, 30, 31, 40, 58];
        if (!in_array($current_user_id, $allowed_ids)) {
            wp_redirect(home_url('/client-login'));
            exit;
        }
    }
});


//EMAILS
//
//
//

add_action('save_post', function($post_id) {
    // 1️⃣ Only run for your front-end ACF form on power_order
    if (!isset($_POST['acff']['post'])) return;
    if (get_post_type($post_id) !== 'power_order') return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;

    $acf  = $_POST['acff']['post'];
    $post = get_post($post_id);

	// 🔕 Skip emails if temporary checkbox is checked
// if (!empty($acf['field_686e89b9a2f97'])) return;

$skip_checkbox = $acf['field_686e89b9a2f97'] ?? [];
if (in_array('Ikke send epost', (array)$skip_checkbox, true)) return;

	
	
    // ←— NEW: detect “first save” vs “update”
    $is_new = ($post->post_date_gmt === $post->post_modified_gmt);
    // ←— NEW: only ever treat it as “new” once
    if ($is_new && get_post_meta($post_id, '_otman_email_sent', true)) {
      $is_new = false;
    }

    // 2️⃣ Author info
    $author_id      = $post->post_author;
    $customer_name  = get_the_author_meta('display_name', $author_id);
    $customer_email = get_the_author_meta('user_email',   $author_id);
    if (!is_email($customer_email)) return;

    // 3️⃣ Helper: always use POST if present, else DB
    function val($acf, $key, $fname, $pid) {
        if (isset($acf[$key])) {
            return $acf[$key];
        }
        return get_field($fname, $pid);
    }

    // 4️⃣ Gather fields
    $order_number = val($acf, 'field_681b2396296cf', 'bestillingsnr',        $post_id) ?: '(ukjent)';
    $pickup       = val($acf, 'field_68248210acd3d', 'pickup_address',      $post_id);
    $rows         = isset($acf['field_68248234acd3e'])
                  ? $acf['field_68248234acd3e']
                  : get_field('extra_pickup_locations',$post_id);
    $extra_pts    = [];
    if (is_array($rows)) {
        foreach ($rows as $r) {
            $p = trim($r['field_68248274acd3f'] ?? $r['pickup'] ?? '');
            if ($p) $extra_pts[] = esc_html($p);
        }
    }
    $delivery     = val($acf, 'field_6824829aacd40', 'delivery_address',    $post_id);
	 $retur     = val($acf, 'field_68499231b558f', 'returadresse',    $post_id);
    $total_km     = val($acf, 'field_682482a1acd41', 'total_km',            $post_id);
    $raw_date     = val($acf, 'field_682358b62c3b4', 'leveringsdato',       $post_id);
    $leveringsdato= '';
    if ($raw_date) {
        $d = DateTime::createFromFormat('Ymd', $raw_date);
        $leveringsdato = $d ? $d->format('d.m.Y') : esc_html($raw_date);
    }
//     $tidsvindu    = val($acf, 'field_681b23b73d2d2', 'tidsvindu_for_levering',$post_id);
// --- Correct tidsvindu logic for emails (manual override + fallback) ---

// Saved dropdown value:
$tv_saved = val($acf, 'field_681b23b73d2d2', 'tidsvindu_for_levering', $post_id);

// Manual override fields (use key first; fall back to name if needed)
$fra_raw  = val($acf, 'field_68c96a6e01ff4', 'endre_tid_fra', $post_id);
$til_raw  = val($acf, 'field_68c96db7722ba', 'endre_tid_til', $post_id);

$fra = is_string($fra_raw) ? trim($fra_raw) : '';
$til = is_string($til_raw) ? trim($til_raw) : '';

$has_manual = ($fra !== '' && $til !== '' && $fra !== '00:00' && $til !== '00:00');

if ($has_manual) {
    // Manual time always overrides—even if dropdown is "Kontakt kunde"
    $tidsvindu = $fra . ' - ' . $til;
} else {
    // If no manual override and saved value is empty or "Kontakt kunde", show 6:00–6:05
    $is_kontakt = is_string($tv_saved) && strcasecmp(trim($tv_saved), 'Kontakt kunde') === 0;
    $tidsvindu  = ($tv_saved === '' || $is_kontakt) ? '6:00 - 6:05' : $tv_saved;
}

    $beskrivelse  = val($acf, 'field_681b23fb857b5', 'beskrivelse',         $post_id);
    $kunde_navn   = val($acf, 'field_681b22d0d5d0e', 'kundens_navn',        $post_id);
    $kunde_email  = val($acf, 'field_681b230e921a5', 'e-postadresse',       $post_id);
    $telefon      = val($acf, 'field_681b2332f7eff', 'telefon',             $post_id);
    $etasje_nr    = val($acf, 'field_681b24512a419', 'etasje_nr',           $post_id);
    $heis_raw     = val($acf, 'field_681b243306693', 'heis',                $post_id);
    $heis         = $heis_raw ? 'JA' : '';
    $kasserers_nn = val($acf, 'field_681b2417d6a19', 'kasserers_navn',      $post_id);
    $kasserers_tel= val($acf, 'field_6823595de4d61', 'kasserers_telefon',   $post_id);
    $driver       = val($acf, 'field_682dd55f46404', 'driver',              $post_id);
    $status_val   = val($acf, 'field_682dd6dba40f7', 'status',              $post_id) ?: 'processing';
    $status_obj   = get_field_object('field_682dd6dba40f7',$post_id);
	  $status_notes       = val($acf, 'field_682dda05fccb7', 'status_notes',              $post_id);
    $status_label = $status_obj['choices'][$status_val] ?? $status_val;
    $price_html   = val($acf, 'field_6835ca7fb0cfd', 'price_breakdown_html',$post_id);

    // 5️⃣ Inline CSS
    $css = '<style>
      .order-detail-body{display:flex;gap:30px;}
      .order-detail-info,.order-detail-breakdown{flex:1;}
      .price-breakdown-wrapper{display:flex;flex-direction:column;gap:10px;margin-bottom:60px;}
      .price-group{margin-bottom:10px;}
      .price-group-label{font-weight:bold;margin-bottom:6px;}
      .price-breakdown-row{display:flex;justify-content:space-between;border-bottom:1px dotted #ccc;padding:4px 0;}
      .price-breakdown-label{flex:1;}
      .price-breakdown-price{text-align:right;font-weight:500;min-width:80px;}
      .price-summary{border-top:2px solid #333;margin-top:12px;padding-top:8px;}
    </style>';

    // 6️⃣ Build two-column block
    ob_start();
    echo '<div class="order-detail-body">';
      echo '<div class="order-detail-info">';
     
	 if ($customer_name) echo "<p><strong>Bestiller:</strong> ".esc_html($customer_name)."</p>";
 if ($leveringsdato) echo "<p><strong>Leveringsdato:</strong> ".esc_html($leveringsdato)."</p>";
        if ($pickup)        echo "<p><strong>Henteadresse:</strong> ".esc_html($pickup)."</p>";
        if ($extra_pts)     echo "<p><strong>Ekstra hentesteder:</strong> ".implode(', ',$extra_pts)."</p>";
        if ($delivery)      echo "<p><strong>Leveringsadresse:</strong> ".esc_html($delivery)."</p>";
	 if ($retur)      echo "<p><strong>Returadresse:</strong> ".esc_html($retur)."</p>";
        if ($total_km)      echo "<p><strong>Total kjøreavstand:</strong> ".esc_html($total_km)."</p>";
       
        if ($tidsvindu)     echo "<p><strong>Tidsvindu for levering:</strong> ".esc_html($tidsvindu)."</p>";
        if ($order_number)  echo "<p><strong>Power Bilagsnummer:</strong> ".esc_html($order_number)."</p>";
        if ($beskrivelse)   echo "<p><strong>Beskrivelse:</strong> ".esc_html($beskrivelse)."</p>";
        if ($kunde_navn)    echo "<p><strong>Kundens Navn:</strong> ".esc_html($kunde_navn)."</p>";
        if ($kunde_email)   echo "<p><strong>E-postadresse:</strong> ".esc_html($kunde_email)."</p>";
        if ($telefon)       echo "<p><strong>Telefon:</strong> ".esc_html($telefon)."</p>";
        if ($etasje_nr)     echo "<p><strong>Etasje nr:</strong> ".esc_html($etasje_nr)."</p>";
        if ($heis)          echo "<p><strong>Heis:</strong> ".esc_html($heis)."</p>";
        if ($kasserers_nn)  echo "<p><strong>Kasserers navn:</strong> ".esc_html($kasserers_nn)."</p>";
        if ($kasserers_tel) echo "<p><strong>Kasserers telefon:</strong> ".esc_html($kasserers_tel)."</p>";
        if ($driver)        echo "<p><strong>Driver:</strong> ".esc_html($driver)."</p>";
        if ($status_label)  echo "<p><strong>Status:</strong> ".esc_html($status_label)."</p>";
	
	   echo "<p><strong>Bestillingsdato:</strong> ".esc_html(get_the_date('d.m.Y',$post_id))."</p>";
	
	if ($status_notes)  echo "<p><strong>Status notes:</strong> ".esc_html($status_notes)."</p>";
      echo '</div>';
      echo '<div class="order-detail-breakdown">'.$price_html.'</div>';
    echo '</div>';
    $block = ob_get_clean();

    // 7️⃣ Send e-mails
    $headers = ['Content-Type: text/html; charset=UTF-8'];
    // ←— NEW: customer subject uses $is_new
    $sub_c = $is_new
      ? "Takk for forespørselen – ordrenr. {$order_number}"
      : "Bestillingen din er oppdatert – ordrenr. {$order_number}";

    if ($is_new) {
      $body_c = $css
        . "<p>Hei ".esc_html($customer_name).",</p>"
        . "<p>Din forespørsel om transporttjenester er sendt inn med ordrenummer "
        . "<strong>".esc_html($order_number)."</strong>.</p>"
		  . "<p>Statusen for bestillingen din er<strong> {$status_label}</strong></p>"
        . "<p>Varene og tjenestene som er inkludert i bestillingen er:</p>"
       . $block
  . "<p>Vi vil gjennomgå forespørselen din og informere deg om statusen for bestillingen din så snart som mulig.</p>"
  . "<p>For å se bestillingen din, <a href=\"https://otman.no/client-login\">logg inn</a>.</p>"
  . "<p>Hvis du har spørsmål, vennligst kontakt teamet vårt.</p>"
  . "<p>Med vennlig hilsen,<br>Otman Transport AS | <a href=\"https://otman.no\">otman.no</a> <br> +47 402 84 977 | <a href=\"mailto:bestilling@otman.no\">bestilling@otman.no</a></p>"
  . "<p><img src=\"https://otman.no/wp-content/uploads/2025/05/logo-removebg.png\" alt=\"Otman Transport Logo\" style=\"max-width: 300px; height: auto; margin-top: 10px;\"></p>";
    } else {
      $body_c = $css
        . "<p>Hei ".esc_html($customer_name).",</p>"
        . "<p>Bestillingen din er oppdatert.</p>"
		  . "<p>Statusen for bestillingen din er <strong> {$status_label}</strong></p>"
		  
		   . "<p>Varene og tjenestene som er inkludert i bestillingen er:</p>"
        . $block
  . "<p>For å se bestillingen din, <a href=\"https://otman.no/client-login\">logg inn</a>.</p>"
  . "<p>Hvis du har spørsmål, kan du kontakte teamet vårt.</p>"
  . "<p>Med vennlig hilsen,<br>Otman Transport AS | <a href=\"https://otman.no\">otman.no</a> <br> +47 402 84 977 | <a href=\"mailto:bestilling@otman.no\">bestilling@otman.no</a></p>"
  . "<p><img src=\"https://otman.no/wp-content/uploads/2025/05/logo-removebg.png\" alt=\"Otman Transport Logo\" style=\"max-width: 300px; height: auto; margin-top: 10px;\"></p>";
    }
    wp_mail($customer_email, $sub_c, $body_c, $headers);

    // Admin
    $sub_a = ($is_new?'🆕 Ny ordre':'✏️ Endret ordre')." #{$order_number} fra {$customer_name}";
    $body_a = $css
     
      . "<p>Oversikt over bestillingen:</p>"
      . $block
	 . "<p>For å se bestillingen, <a href=\"https://otman.no/client-login\">logg inn</a>.</p>"
		  . "<p>Med vennlig hilsen,<br>Otman Transport AS | <a href=\"https://otman.no\">otman.no</a> <br> +47 402 84 977 | <a href=\"mailto:bestilling@otman.no\">bestilling@otman.no</a></p>"
  . "<p><img src=\"https://otman.no/wp-content/uploads/2025/05/logo-removebg.png\" alt=\"Otman Transport Logo\" style=\"max-width: 300px; height: auto; margin-top: 10px;\"></p>"; 
    wp_mail('bestilling@otman.no',$sub_a,$body_a,$headers);

    // ←— NEW: mark that “new” mail has been sent
    if ($is_new) {
      update_post_meta($post_id, '_otman_email_sent', 1);
    }

}, 10, 1);



//CHANGE AUTHOR OF THE POST
//
add_action('save_post', function($post_id) {
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    if (wp_is_post_revision($post_id)) return;
    if (get_post_type($post_id) !== 'power_order') return;

    $acf_post = $_POST['acff']['post'] ?? null;
    $raw_author = $acf_post['field_684ad0c12c958'] ?? null;

    if (!$raw_author) {
        $raw_author = get_field('field_684ad0c12c958', $post_id);
    }

    $selected_author_id = is_numeric($raw_author) ? intval($raw_author) : null;
    $current_author_id = (int) get_post_field('post_author', $post_id);

    if (
        $selected_author_id &&
        $selected_author_id !== $current_author_id &&
        get_user_by('ID', $selected_author_id)
    ) {
        // DEFER post author update until shutdown (after ACF is done)
        add_action('shutdown', function () use ($post_id, $selected_author_id) {
            remove_action('save_post', 'deferred_author_update', 20); // prevent recursion
            wp_update_post([
                'ID' => $post_id,
                'post_author' => $selected_author_id,
            ]);
        });
    }
}, 20);








add_filter('acf/validate_save_post', function () {
  if (!isset($_POST['acff']['post'])) return;

  $post_id = $_POST['post_id'] ?? null;
  if (!$post_id || get_post_type($post_id) !== 'power_order') return;

  $flex_key = 'field_682b0fa395c44';
  $posted_rows = $_POST['acff']['post'][$flex_key] ?? [];

  if (!is_array($posted_rows)) return;

  $layouts = get_field_object($flex_key)['layouts'] ?? [];

  foreach ($posted_rows as $row_key => $posted_fields) {
    if (!preg_match('/row-(\d+)/', $row_key, $match)) continue;
    $index = intval($match[1]);
    $layout_name = $posted_fields['acf_fc_layout'] ?? '';
    if (!isset($layouts[$layout_name])) continue;

    foreach ($layouts[$layout_name]['sub_fields'] as $subfield) {
      $sub_key = $subfield['key'];
      $type = $subfield['type'];
      $has_value = array_key_exists($sub_key, $posted_fields);

      if (!$has_value) {
        // Inject default empty value into $_POST before ACF saves
        $empty = ($type === 'checkbox' || ($type === 'select' && $subfield['multiple'])) ? [] : '';
        $_POST['acff']['post'][$flex_key][$row_key][$sub_key] = $empty;
      }
    }
  }
});



//CHANGING COLORS FOR STATUS FIELDS

add_filter('acf/prepare_field/key=field_682dd6dba40f7','otm_add_status_wrapper');
function otm_add_status_wrapper( $field ) {
  
  // if there’s no value yet, just return
  if( empty($field['value']) ) return $field;
  
  // sanitize and append a class: status-Behandling, status-Aktiv, etc.
  $klass = 'status-' . sanitize_html_class( $field['value'] );
  $field['wrapper']['class'] .= ' ' . $klass;
  
  return $field;
}

// EXPRESS DELIVERY TIME STAMP
// 

add_action( 'save_post_order', function( $post_id, $post, $update ) {
  // 1) Only run for our CPT
  if ( $post->post_type !== 'order' ) {
    return;
  }
  // 2) Only on initial creation ($update===false)
  if ( $update ) {
    return;
  }
  // 3) If it already has a value, bail
  if ( get_field( 'field_684feac9c43b7', $post_id ) ) {
    return;
  }
  // 4) Format “now” in Y-m-d H:i:s for ACF
  $now = current_time( 'mysql' );  // e.g. "2025-06-14 09:30:00"
  // 5) Write it
  update_field( 'field_684feac9c43b7', $now, $post_id );
}, 10, 3 );


//GDPR 
//
// 1) Enqueue GDPR modal script only for non-admin-portal subscribers
add_action( 'wp_enqueue_scripts', 'enqueue_client_gdpr_modal' );
function enqueue_client_gdpr_modal() {
    if ( ! is_user_logged_in() ) {
        return;
    }

    $user_id = get_current_user_id();

    // ← REPLACE these IDs with your actual admin-portal subscriber IDs
    $admin_portal_users = [ 7, 4 /*, 123, 456, … */ ];

    // 1a) Skip admin-portal users entirely
    if ( in_array( $user_id, $admin_portal_users, true ) ) {
        return;
    }

    // 1b) Skip if they’ve already accepted
    if ( get_user_meta( $user_id, 'gdpr_accepted', true ) ) {
        return;
    }

    // 1c) Only fire on the client portal page (change slug if needed)
    if ( ! is_page( 'powerorder' ) ) {
        return;
    }

    // 2) Enqueue SweetAlert2 + our small initializer script
    wp_enqueue_script( 'sweetalert2',
        'https://cdn.jsdelivr.net/npm/sweetalert2@11',
        [], null, true
    );
    wp_enqueue_script( 'gdpr-accept',
        get_stylesheet_directory_uri() . '/js/gdpr-accept.js',
        [ 'jquery', 'sweetalert2' ], null, true
    );
    wp_localize_script( 'gdpr-accept', 'GDPR_SETTINGS', [
        'ajax_url'  => admin_url( 'admin-ajax.php' ),
        'rules_url' => site_url( '/personvern' ),   // ← your GDPR rules page
        'nonce'     => wp_create_nonce( 'gdpr_accept_nonce' ),
    ] );
}

// 3) AJAX handler: mark GDPR as accepted
add_action( 'wp_ajax_accept_gdpr', 'handle_gdpr_accept' );
function handle_gdpr_accept() {
    check_ajax_referer( 'gdpr_accept_nonce', 'nonce' );
    if ( is_user_logged_in() ) {
        update_user_meta( get_current_user_id(), 'gdpr_accepted', time() );
    }
    wp_send_json_success();
}

//TRASH POST HANDLER
//
//
/**
 * Intercept the ACF save, trash instead of update
 */
add_filter('acf/pre_save_post', 'my_acf_handle_delete_order', 5);
function my_acf_handle_delete_order( $post_id ) {

    // Only run on front-end (not wp-admin)
    if ( is_admin() ) {
        return $post_id;
    }

    // Did our button fire?
    if ( empty($_POST['acf']['delete_order']) ) {
        return $post_id;  // no, so proceed with normal save
    }

    // Confirm the user really clicked “Delete order”
    if ( $_POST['acf']['delete_order'] !== 'Delete order' ) {
        return $post_id;
    }

    // Permission check (adjust to your needs; by default only editors+ can)
    if ( ! current_user_can( 'delete_post', $post_id ) ) {
        wp_die( 'You do not have permission to delete this post.', 'Forbidden', [ 'response' => 403 ] );
    }

    // Trash the post
    wp_trash_post( $post_id );

    // Redirect back to wherever you like (home, archive, etc)
    $redirect = wp_get_referer() ?: home_url();
    wp_safe_redirect( $redirect );
    exit;
}

/**
 * Add a one-time confirm() on the Delete button
 */
add_action('wp_footer','my_acf_delete_order_confirm_js');
function my_acf_delete_order_confirm_js() {
    if ( ! is_singular() || ! is_user_logged_in() ) {
        return;
    }
    ?>
    <script>
    document.addEventListener('click', function(e){
      var btn = e.target.closest('.delete-post-button');
      if (!btn) return;
      if (!confirm('Are you sure you want to move this post to the Trash?')) {
        e.preventDefault();
      }
    });
    </script>
    <?php
}

add_action('init', function () {
    if (isset($_GET['test_gsm_order'])) {
        $api_key = 'cf6083c19d96dd1654a2987b726388a34df76dad'; // your working key
        $account_url = 'https://api.gsmtasks.com/accounts/b63e1aea-b3b9-4c1a-bd35-ae1c43d80a5d/';

        $payload = [
            'account' => $account_url,
            'reference' => 'WP test order #' . time(),
            'orderer' => ['name' => 'WordPress Test'],
            'tasks_data' => [[
                'category' => 'drop_off',
                'address' => ['raw_address' => 'Storgata 1, Oslo'],
                'contact' => [
                    'name' => 'Test Person',
                    'emails' => ['test@example.com'],
                    'phones' => ['+4712345678'],
                ],
                'description' => 'This is a test task from WordPress',
                'complete_after' => gmdate('c', strtotime('+1 day 09:00')),
                'complete_before' => gmdate('c', strtotime('+1 day 17:00')),
            ]]
        ];

        $response = wp_remote_post('https://api.gsmtasks.com/orders/', [
            'headers' => [
                'Authorization' => 'ApiKey ' . $api_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'body' => json_encode($payload),
        ]);

        if (is_wp_error($response)) {
            echo '❌ Error: ' . esc_html($response->get_error_message());
        } else {
            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);
            echo "<pre>✅ Response Code: $code\n\n";
            print_r($body);
            echo '</pre>';
        }

        exit;
    }
});


add_filter('acf/load_value/key=field_686e89b9a2f97', function($value, $post_id, $field) {
    // Reset checkbox on frontend form
    if (is_admin()) return $value;
    return []; // Uncheck everything
}, 10, 3);



// HIDDEN ACF FIELD TO SORT EMPTY LEVERINGSDATO
// 
// 
// add_action('save_post_power_order', function ($post_id) {
//   if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
//   if (wp_is_post_revision($post_id)) return;

//   $raw = $_POST['acff']['post']['field_682358b62c3b4'] ?? '';
//   $sortable = '9999-12-31'; // fallback

//   // If format is Ymd (e.g. 20250725), convert it
//   if (preg_match('/^\d{8}$/', $raw)) {
//     $sortable = substr($raw, 0, 4) . '-' . substr($raw, 4, 2) . '-' . substr($raw, 6, 2);
//   }

//   update_post_meta($post_id, 'leveringsdato_sortable', $sortable);
// }, 20);

// Normalize leveringsdato → leveringsdato_sortable after ACF saves fields



// === Normalize raw leveringsdato into Y-m-d; empties -> 9999-12-31 (sort last) ===
if (!function_exists('otman_ldato_normalize')) {
    function otman_ldato_normalize($raw, $empty_as = '9999-12-31') {
        $raw = is_string($raw) ? trim($raw) : '';
        if ($raw === '') return $empty_as;

        // Ymd (ACF raw)
        if (preg_match('/^\d{8}$/', $raw)) {
            return substr($raw, 0, 4) . '-' . substr($raw, 4, 2) . '-' . substr($raw, 6, 2);
        }
        // Y-m-d
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            return $raw;
        }
        // d/m/Y, d.m.Y, d-m-Y
        if (preg_match('#^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$#', $raw, $m)) {
            return sprintf('%04d-%02d-%02d', (int)$m[3], (int)$m[2], (int)$m[1]);
        }

        $ts = strtotime($raw);
        return $ts ? date('Y-m-d', $ts) : $empty_as;
    }
}

/**
 * 1) When ACFE Hidden (leveringsdato_sortable) is saving, override its value.
 *    Field keys from your setup:
 *      - leveringsdato (date) key:            field_682358b62c3b4
 *      - leveringsdato_sortable (ACFE hidden) key: field_68badca7ac5c7
 */
add_filter('acf/update_value/key=field_68badca7ac5c7', function ($value, $post_id) {
    if (!is_numeric($post_id) || get_post_type($post_id) !== 'power_order') {
        return $value;
    }

    // Prefer RAW DB (Ymd) if already saved in this request, else fall back to POST
    $raw = get_field('leveringsdato', $post_id, false);
    if ($raw === '' || $raw === null) {
        $raw = isset($_POST['acff']['post']['field_682358b62c3b4']) ? $_POST['acff']['post']['field_682358b62c3b4']
             : (isset($_POST['acf']['field_682358b62c3b4']) ? $_POST['acf']['field_682358b62c3b4'] : '');
    }

    // Return the normalized value so ACF writes it (prevents ACFE from saving empty '')
    return otman_ldato_normalize($raw, '9999-12-31');
}, 20, 2);

/**
 * 2) Final safety pass after ALL ACF fields save (last write wins).
 *    Write directly to meta to avoid recursion.
 */
add_action('acf/save_post', function ($post_id) {
    if (!is_numeric($post_id) || get_post_type($post_id) !== 'power_order') {
        return;
    }

    $raw = get_field('leveringsdato', $post_id, false);
    if ($raw === '' || $raw === null) {
        $raw = isset($_POST['acff']['post']['field_682358b62c3b4']) ? $_POST['acff']['post']['field_682358b62c3b4']
             : (isset($_POST['acf']['field_682358b62c3b4']) ? $_POST['acf']['field_682358b62c3b4'] : '');
    }

    $sortable = otman_ldato_normalize($raw, '9999-12-31');
    update_post_meta($post_id, 'leveringsdato_sortable', $sortable);
}, 999);

/**
 * 3) If the ACFE Hidden field is marked "required", make sure it never blocks submit.
 *    We always provide a value anyway, but this silences any odd validation race.
 */
add_filter('acf/validate_value/key=field_68badca7ac5c7', function ($valid, $value, $field, $input) {
    return true;
}, 10, 4);


// === REDIRECT SUBCONTRACTORS ON LOGIN ===
add_action('wp_login', function($user_login, $user) {
    // Map usernames to redirect URLs
    $redirects = [
       
        'Bahs Kurjer'          => 'https://otman.no/kurjer-delivery-history',
        'Nordline AS'          => 'https://otman.no/kurjer-delivery-history',
        'Tastanovas Matbutikk' => 'https://otman.no/kurjer-delivery-history',
        'Viken Travsport Tanha'=> 'https://otman.no/kurjer-delivery-history',
		'Arnosan AS'=> 'https://otman.no/kurjer-delivery-history',
		'Ievitis Transport'=> 'https://otman.no/kurjer-delivery-history',
		'Stombergas Transport'=> 'https://otman.no/kurjer-delivery-history',
		 'New subcontractor 1'=> 'https://otman.no/kurjer-delivery-history',
		 'New subcontractor 2'=> 'https://otman.no/kurjer-delivery-history',
		 'Bygg Service Vaicuss'=> 'https://otman.no/kurjer-delivery-history',
		'Linebox'=> 'https://otman.no/kurjer-delivery-history',
		'Christiania flytt og vask AS'=> 'https://otman.no/kurjer-delivery-history',
		'Albittar Transport AS' => 'https://otman.no/kurjer-delivery-history',
    ];

    if (isset($redirects[$user_login])) {
        set_transient('redirect_flag_' . $user->ID, $redirects[$user_login], 60); // valid for 60s
    }
}, 10, 2);

add_action('template_redirect', function() {
    if (is_user_logged_in()) {
        $user = wp_get_current_user();
        $key = 'redirect_flag_' . $user->ID;
        $target_url = get_transient($key);

        if ($target_url) {
            delete_transient($key);
            wp_redirect($target_url);
            exit;
        }
    }
});


// === REDIRECT OTHER CLIENTS ON LOGIN ===
add_action('wp_login', function($user_login, $user) {
    // Map usernames to redirect URLs
    $redirects = [
       
        'Elkjop Alna'          => 'https://otman.no/order',
        'Banor Transport AS'          => 'https://otman.no/order',
        'Ralfs' => 'https://otman.no/order',
        'OsloKontorMobler' => 'https://otman.no/order'
     
    ];

    if (isset($redirects[$user_login])) {
        set_transient('redirect_flag_' . $user->ID, $redirects[$user_login], 60); // valid for 60s
    }
}, 10, 2);

add_action('template_redirect', function() {
    if (is_user_logged_in()) {
        $user = wp_get_current_user();
        $key = 'redirect_flag_' . $user->ID;
        $target_url = get_transient($key);

        if ($target_url) {
            delete_transient($key);
            wp_redirect($target_url);
            exit;
        }
    }
});


//POST AUTHOR SHORTCODE
//
add_action('wp_ajax_get_post_author_name', function () {
    $post_id = intval($_GET['post_id'] ?? 0);
    if (!$post_id) {
        wp_send_json_error('Missing post_id');
    }

    $author_id = get_post_field('post_author', $post_id);
    if (!$author_id) {
        wp_send_json_error('No author');
    }

    $author_name = get_the_author_meta('display_name', $author_id);
    wp_send_json_success(['author_name' => $author_name ?: 'Ukjent']);
});


// Outputs <script>window.CURRENT_USER_KEY = "username";</script>

add_action('wp_head', function () {
  if ( ! is_user_logged_in() ) return;
  

  $key  = wp_get_current_user()->user_login;
  $json = wp_json_encode($key);
  echo "<script>window.CURRENT_USER_KEY = {$json};</script>";
});


add_action('save_post_power_order', function($post_id, $post, $update){
  if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
  if ($post->post_status !== 'publish') return;

  $cur = get_post_meta($post_id,'status',true);
  if ($cur === '' || $cur === null) {
    update_post_meta($post_id,'status','processing');
  }
}, 10, 3);


