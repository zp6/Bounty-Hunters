<!DOCTYPE html>
<!--
  Fixed welcome.blade.php with CSRF meta tag and security headers.
  Fixes #751.
-->
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta http-equiv="X-Content-Type-Options" content="nosniff">
    <meta http-equiv="X-Frame-Options" content="SAMEORIGIN">
    <meta http-equiv="X-XSS-Protection" content="1; mode=block">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <title>Laravel</title>
</head>
<body>
    <div id="app">
        <h1>Welcome</h1>
        <p>CSRF token is set in meta tag for AJAX requests.</p>
    </div>
    <script>
        // Set CSRF token for all AJAX requests
        window.csrfToken = document.querySelector('meta[name="csrf-token"]').content;
    </script>
</body>
</html>
