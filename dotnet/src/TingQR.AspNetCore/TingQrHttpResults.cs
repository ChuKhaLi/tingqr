using Microsoft.AspNetCore.Http;
using TingQR.Rendering;

namespace TingQR.AspNetCore;

/// <summary>QR codes as HTTP results, for handlers that decide the response themselves.</summary>
public static class TingQrHttpResults
{
    /// <summary>
    /// Serve <paramref name="payload"/> as an SVG image: 200 with <c>Content-Type: image/svg+xml; charset=utf-8</c>,
    /// <c>X-Content-Type-Options: nosniff</c>, a Content-Security-Policy that allows only inline styles and data: images,
    /// and Cache-Control. A null or empty payload gives 404. A <see cref="TingQrException"/> while rendering (payload too
    /// long, bad options, a logo that is not a <c>data:image/</c> URI…) gives 500 with <c>{"error":{"code":"…"}}</c>
    /// only; the code and message are logged (category <c>TingQR.AspNetCore.TingQrSvg</c>). Never throws: unlike
    /// <see cref="TingQrEndpointExtensions.WithTingQrSvg{TBuilder}"/>, options are checked when the result runs.
    /// </summary>
    /// <param name="payload">The QR payload the app built; never build it from URL or query parameters.</param>
    /// <param name="options">SVG options merged over <see cref="TingQrOptions.Svg"/> key by key.</param>
    /// <param name="cacheControl">Cache-Control header; null or blank means <see cref="TingQrOptions.CacheControl"/>, then "private, max-age=300".</param>
    public static IResult Svg(string? payload, SvgOptions? options = null, string? cacheControl = null) =>
        SvgResponse.For(payload, options, cacheControl, checkRoute: true);
}
