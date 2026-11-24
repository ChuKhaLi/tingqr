using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using TingQR.Rendering;

namespace TingQR.AspNetCore;

/// <summary>Serves Minimal API endpoints as QR images.</summary>
public static class TingQrEndpointExtensions
{
    /// <summary>
    /// Serve the QR payload this endpoint returns (a string, or null; sync, <c>Task</c> or <c>ValueTask</c>) as an SVG
    /// image: 200 for every HTTP method with <c>Content-Type: image/svg+xml; charset=utf-8</c>,
    /// <c>X-Content-Type-Options: nosniff</c>, a Content-Security-Policy that allows only inline styles and data: images,
    /// and Cache-Control. Null or "" gives 404. A <see cref="TingQrException"/> thrown by the handler or while rendering
    /// gives 500 with <c>{"error":{"code":"…"}}</c> only (the app's exception handler does not see it); the code and
    /// message are logged (category <c>TingQR.AspNetCore.TingQrSvg</c>). Other exceptions reach the app unchanged; a
    /// result of another type throws <see cref="InvalidOperationException"/>.
    /// </summary>
    /// <param name="builder">The endpoint, e.g. from <c>MapGet</c>.</param>
    /// <param name="options">
    /// SVG options merged over <see cref="TingQrOptions.Svg"/> key by key. Checked right here: a bad option or a logo
    /// that is not a <c>data:image/</c> URI throws <see cref="TingQrException"/> at startup.
    /// </param>
    /// <param name="cacheControl">
    /// Cache-Control header; null or blank means <see cref="TingQrOptions.CacheControl"/>, then "private, max-age=300".
    /// Printable ASCII only: a control or non-ASCII character throws <see cref="TingQrException"/> right here.
    /// </param>
    public static TBuilder WithTingQrSvg<TBuilder>(this TBuilder builder, SvgOptions? options = null, string? cacheControl = null)
        where TBuilder : IEndpointConventionBuilder
    {
        if (builder is null)
        {
            throw new ArgumentNullException(nameof(builder));
        }
        TingQrConfiguration.CheckRouteOptions(options);
        // Stryker disable once String : error message
        TingQrConfiguration.CheckCacheControl(cacheControl, "WithTingQrSvg: cacheControl");
        var filter = new TingQrSvgEndpointFilter(options, cacheControl);
        return builder.AddEndpointFilter(filter);
    }
}
