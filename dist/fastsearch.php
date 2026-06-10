<?php
/**
 * Plugin Name: FastSearch
 * Description: Australian postcode search — type a number, see top 3 matching suburbs.
 * Version:     1.0.11
 * Author:      FastSearch
 */

defined('ABSPATH') or die;

define('FASTSEARCH_URL', plugin_dir_url(__FILE__));
define('FASTSEARCH_PATH', plugin_dir_path(__FILE__));

/* ------------------------------------------------------------------ */
/*  Defaults                                                          */
/* ------------------------------------------------------------------ */

function fastsearch_defaults() {
    return array(
        'placeholder'      => 'Type a postcode...',
        'max_results'      => 3,
        'width_mode'       => 'fixed',
        'input_width'      => 300,
        'input_percentage' => 50,
        'border_radius'    => 3,
    );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function fastsearch_input_style($mode, $width, $percentage, $radius) {
    $r = '';
    if ($mode === 'percentage') {
        $r .= 'width:' . absint($percentage) . '%;';
    } elseif ($mode === 'fill') {
        $r .= 'width:100%;';
    } else {
        $r .= 'width:' . absint($width) . 'px;max-width:100%;';
    }
    $r .= 'border-radius:' . absint($radius) . 'px;';
    return $r;
}

/* ------------------------------------------------------------------ */
/*  Frontend assets                                                   */
/* ------------------------------------------------------------------ */

function fastsearch_enqueue_assets() {
    $d = get_option('fastsearch_settings', fastsearch_defaults());

    wp_enqueue_script(
        'fastsearch',
        FASTSEARCH_URL . 'assets/fastsearch.js',
        array(),
        '1.0.11',
        true
    );

    wp_localize_script('fastsearch', 'fastsearch', array(
        'dataUrl'    => FASTSEARCH_URL . 'assets/data.json',
        'maxResults' => absint($d['max_results']),
    ));
}
add_action('wp_enqueue_scripts', 'fastsearch_enqueue_assets');

/* ------------------------------------------------------------------ */
/*  Shortcode                                                         */
/* ------------------------------------------------------------------ */

function fastsearch_shortcode($atts) {
    $d = get_option('fastsearch_settings', fastsearch_defaults());

    $atts = shortcode_atts(array(
        'placeholder'      => $d['placeholder'],
        'max_results'      => $d['max_results'],
        'width_mode'       => $d['width_mode'],
        'input_width'      => $d['input_width'],
        'input_percentage' => $d['input_percentage'],
        'border_radius'    => $d['border_radius'],
    ), $atts, 'fastsearch');

    $ph = esc_attr($atts['placeholder']);
    $st = fastsearch_input_style($atts['width_mode'], $atts['input_width'], $atts['input_percentage'], $atts['border_radius']);

    ob_start();
    ?>
    <input type="text" id="postcode-input" placeholder="<?php echo $ph; ?>" autofocus
           style="<?php echo $st; ?>font-size:16px;padding:8px 12px;">
    <div id="suggestions" style="margin-top:6px;font-size:14px;"></div>
    <div id="results" style="margin-top:12px;font-size:15px;"></div>
    <?php
    return ob_get_clean();
}
add_shortcode('fastsearch', 'fastsearch_shortcode');

/* ------------------------------------------------------------------ */
/*  Settings page                                                     */
/* ------------------------------------------------------------------ */

function fastsearch_admin_menu() {
    add_menu_page(
        'FastSearch Settings',
        'FastSearch',
        'manage_options',
        'fastsearch',
        'fastsearch_settings_page',
        'dashicons-search',
        80
    );
}
add_action('admin_menu', 'fastsearch_admin_menu');

function fastsearch_settings_page() {
    ?>
    <div class="wrap">
        <h1>FastSearch Settings</h1>
        <form method="post" action="options.php">
            <?php
            settings_fields('fastsearch_settings_group');
            do_settings_sections('fastsearch');
            submit_button();
            ?>
        </form>
    </div>
    <?php
}

function fastsearch_register_settings() {
    register_setting('fastsearch_settings_group', 'fastsearch_settings', array(
        'sanitize_callback' => 'fastsearch_sanitize_settings',
        'default'           => fastsearch_defaults(),
    ));

    add_settings_section(
        'fastsearch_main',
        'Search Configuration',
        '__return_false',
        'fastsearch'
    );

    add_settings_field(
        'fastsearch_placeholder',
        'Placeholder text',
        'fastsearch_field_placeholder',
        'fastsearch',
        'fastsearch_main'
    );

    add_settings_field(
        'fastsearch_max_results',
        'Max results shown',
        'fastsearch_field_max_results',
        'fastsearch',
        'fastsearch_main'
    );

    add_settings_field(
        'fastsearch_width_mode',
        'Width mode',
        'fastsearch_field_width_mode',
        'fastsearch',
        'fastsearch_main'
    );

    add_settings_field(
        'fastsearch_input_width',
        'Fixed width (px)',
        'fastsearch_field_input_width',
        'fastsearch',
        'fastsearch_main'
    );

    add_settings_field(
        'fastsearch_input_percentage',
        'Percentage width (%)',
        'fastsearch_field_input_percentage',
        'fastsearch',
        'fastsearch_main'
    );

    add_settings_field(
        'fastsearch_border_radius',
        'Border radius (px)',
        'fastsearch_field_border_radius',
        'fastsearch',
        'fastsearch_main'
    );
}
add_action('admin_init', 'fastsearch_register_settings');

function fastsearch_sanitize_settings($input) {
    $d = fastsearch_defaults();
    $modes = array('fixed', 'percentage', 'fill');
    $mode = $input['width_mode'] ?? $d['width_mode'];
    if (!in_array($mode, $modes, true)) {
        $mode = $d['width_mode'];
    }
    return array(
        'placeholder'      => sanitize_text_field($input['placeholder'] ?? $d['placeholder']),
        'max_results'      => absint($input['max_results'] ?: $d['max_results']),
        'width_mode'       => $mode,
        'input_width'      => absint($input['input_width'] ?: $d['input_width']),
        'input_percentage' => absint($input['input_percentage'] ?: $d['input_percentage']),
        'border_radius'    => absint($input['border_radius'] ?? $d['border_radius']),
    );
}

function fastsearch_field_placeholder() {
    $d = get_option('fastsearch_settings', fastsearch_defaults());
    printf(
        '<input type="text" name="fastsearch_settings[placeholder]" value="%s" class="regular-text">',
        esc_attr($d['placeholder'])
    );
}

function fastsearch_field_max_results() {
    $d = get_option('fastsearch_settings', fastsearch_defaults());
    printf(
        '<input type="number" name="fastsearch_settings[max_results]" value="%d" min="1" max="50" style="width:80px">',
        absint($d['max_results'])
    );
}

function fastsearch_field_width_mode() {
    $d = get_option('fastsearch_settings', fastsearch_defaults());
    $modes = array('fixed' => 'Fixed pixels', 'percentage' => 'Percentage', 'fill' => 'Expand to fill');
    foreach ($modes as $val => $label) {
        $sel = selected($d['width_mode'], $val, false);
        echo '<label style="display:block;margin-bottom:4px;">';
        echo '<input type="radio" name="fastsearch_settings[width_mode]" value="' . esc_attr($val) . '" ' . $sel . '> ';
        echo esc_html($label);
        echo '</label>';
    }
}

function fastsearch_field_input_width() {
    $d = get_option('fastsearch_settings', fastsearch_defaults());
    printf(
        '<input type="number" name="fastsearch_settings[input_width]" value="%d" min="100" max="1200" style="width:80px"> px',
        absint($d['input_width'])
    );
}

function fastsearch_field_input_percentage() {
    $d = get_option('fastsearch_settings', fastsearch_defaults());
    printf(
        '<input type="number" name="fastsearch_settings[input_percentage]" value="%d" min="10" max="100" style="width:80px"> %%',
        absint($d['input_percentage'])
    );
}

function fastsearch_field_border_radius() {
    $d = get_option('fastsearch_settings', fastsearch_defaults());
    printf(
        '<input type="number" name="fastsearch_settings[border_radius]" value="%d" min="0" max="30" style="width:80px"> px',
        absint($d['border_radius'])
    );
}

/* ------------------------------------------------------------------ */
/*  Gutenberg block                                                   */
/* ------------------------------------------------------------------ */

function fastsearch_register_block() {
    wp_register_script(
        'fastsearch-block',
        FASTSEARCH_URL . 'blocks/fastsearch/block.js',
        array('wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n'),
        '1.0.11',
        true
    );

    wp_localize_script('fastsearch-block', 'fastsearchBlock', array(
        'placeholder' => __('Placeholder text', 'fastsearch'),
        'maxResults'  => __('Max results', 'fastsearch'),
        'inputWidth'  => __('Input width (px)', 'fastsearch'),
        'preview'     => __('FastSearch will appear here on the front end.', 'fastsearch'),
    ));

    register_block_type(
        FASTSEARCH_PATH . 'blocks/fastsearch',
        array(
            'render_callback' => 'fastsearch_block_render',
        )
    );
}
add_action('init', 'fastsearch_register_block');

function fastsearch_block_render($attributes) {
    fastsearch_enqueue_assets();

    $mode  = !empty($attributes['widthMode'])       ? $attributes['widthMode']       : 'fixed';
    $w     = !empty($attributes['inputWidth'])       ? $attributes['inputWidth']       : 300;
    $pct   = !empty($attributes['inputPercentage'])  ? $attributes['inputPercentage']  : 50;
    $ph    = !empty($attributes['placeholder'])      ? $attributes['placeholder']      : 'Type a postcode...';
    $br    = isset($attributes['borderRadius'])       ? $attributes['borderRadius']     : 3;
    $st = fastsearch_input_style($mode, $w, $pct, $br);

    ob_start();
    ?>
    <input type="text" id="postcode-input" placeholder="<?php echo esc_attr($ph); ?>" autofocus
           style="<?php echo $st; ?>font-size:16px;padding:8px 12px;">
    <div id="suggestions" style="margin-top:6px;font-size:14px;"></div>
    <div id="results" style="margin-top:12px;font-size:15px;"></div>
    <?php
    return ob_get_clean();
}
