<?php
/**
 * Plugin Name: Otman Postmeta REST Endpoint
 * Description: Provides authenticated REST endpoints for historical Otman order postmeta import.
 * Version: 1.0.0
 * Author: Otman
 */

if (!defined('ABSPATH')) {
    exit;
}

const OTMAN_POSTMETA_DEFAULT_TABLE_PREFIX = '21gLt_';

function otman_postmeta_rest_secret(): string
{
    if (defined('OTMAN_POSTMETA_REST_SECRET') && is_string(OTMAN_POSTMETA_REST_SECRET)) {
        return trim(OTMAN_POSTMETA_REST_SECRET);
    }

    $env_secret = getenv('OTMAN_POSTMETA_REST_SECRET');
    return is_string($env_secret) ? trim($env_secret) : '';
}

function otman_postmeta_rest_request_secret(WP_REST_Request $request): string
{
    $header_secret = $request->get_header('x-otman-postmeta-secret');
    if (is_string($header_secret) && trim($header_secret) !== '') {
        return trim($header_secret);
    }

    $query_secret = $request->get_param('secret');
    return is_string($query_secret) ? trim($query_secret) : '';
}

function otman_postmeta_rest_permission(WP_REST_Request $request)
{
    if (is_user_logged_in() && current_user_can('manage_options')) {
        return true;
    }

    $configured_secret = otman_postmeta_rest_secret();
    $request_secret = otman_postmeta_rest_request_secret($request);

    if ($configured_secret !== '' && $request_secret !== '' && hash_equals($configured_secret, $request_secret)) {
        return true;
    }

    return new WP_Error(
        'otman_postmeta_rest_forbidden',
        'Authentication required.',
        array('status' => 403)
    );
}

function otman_postmeta_rest_normalize_table_prefix($value): string
{
    $prefix = is_string($value) && trim($value) !== ''
        ? trim($value)
        : OTMAN_POSTMETA_DEFAULT_TABLE_PREFIX;

    if (!preg_match('/^[A-Za-z0-9_]+$/', $prefix)) {
        return '';
    }

    return $prefix;
}

function otman_postmeta_rest_ping(WP_REST_Request $request): WP_REST_Response
{
    return new WP_REST_Response(
        array(
            'ok' => true,
            'plugin' => 'otman-postmeta-rest-endpoint',
        ),
        200
    );
}

function otman_postmeta_rest_get_postmeta(WP_REST_Request $request)
{
    global $wpdb;

    $post_id = absint($request->get_param('post_id'));
    if ($post_id <= 0) {
        return new WP_Error(
            'otman_postmeta_rest_invalid_post_id',
            'post_id is required.',
            array('status' => 400)
        );
    }

    $table_prefix = otman_postmeta_rest_normalize_table_prefix($request->get_param('table_prefix'));
    if ($table_prefix === '') {
        return new WP_Error(
            'otman_postmeta_rest_invalid_table_prefix',
            'table_prefix may only contain letters, numbers, and underscores.',
            array('status' => 400)
        );
    }

    $table_name = $table_prefix . 'postmeta';
    $sql = $wpdb->prepare(
        "SELECT meta_key, meta_value FROM {$table_name} WHERE post_id = %d",
        $post_id
    );
    $rows = $wpdb->get_results($sql, ARRAY_A);

    if (!is_array($rows)) {
        return new WP_Error(
            'otman_postmeta_rest_query_failed',
            'Failed to query postmeta.',
            array('status' => 500)
        );
    }

    return new WP_REST_Response(
        array_map(
            static function (array $row): array {
                return array(
                    'meta_key' => isset($row['meta_key']) ? (string) $row['meta_key'] : '',
                    'meta_value' => isset($row['meta_value']) ? (string) $row['meta_value'] : '',
                );
            },
            $rows
        ),
        200
    );
}

add_action('rest_api_init', static function (): void {
    register_rest_route(
        'otman/v1',
        '/ping',
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'otman_postmeta_rest_ping',
            'permission_callback' => 'otman_postmeta_rest_permission',
        )
    );

    register_rest_route(
        'otman/v1',
        '/postmeta',
        array(
            'methods' => WP_REST_Server::READABLE,
            'callback' => 'otman_postmeta_rest_get_postmeta',
            'permission_callback' => 'otman_postmeta_rest_permission',
            'args' => array(
                'post_id' => array(
                    'required' => true,
                    'sanitize_callback' => 'absint',
                ),
                'table_prefix' => array(
                    'required' => false,
                    'default' => OTMAN_POSTMETA_DEFAULT_TABLE_PREFIX,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
                'secret' => array(
                    'required' => false,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        )
    );
});
