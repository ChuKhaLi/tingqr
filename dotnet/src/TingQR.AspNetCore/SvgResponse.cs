using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TingQR.Rendering;

namespace TingQR.AspNetCore;

/// <summary>
/// The HTTP contract of conformance/http/svg-response.json: a payload → 200 SVG with safe headers; null or "" → 404; a
/// <see cref="TingQrException"/> → 500 with <c>{"error":{"code":…}}</c> only, the message going to the server log (the
/// app builds the payload, so the message may describe its configuration).
/// </summary>
internal static class SvgResponse
{
    /// <summary>Log category of TingQrException entries.</summary>
    public const string LogCategory = "TingQR.AspNetCore.TingQrSvg";

    private const string DefaultCacheControl = "private, max-age=300";

    /// <summary>SVG served directly is a document: no scripts, no external loads, only inline styles and data: images.</summary>
    private const string Csp = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

    /// <summary>
    /// Serve <paramref name="payload"/> with <paramref name="route"/> merged over the app-wide
    /// <see cref="TingQrOptions.Svg"/>. When <paramref name="checkRoute"/> is set, the route options are checked here
    /// (an error is a 500), for callers that could not check them when the route was configured.
    /// </summary>
    public static IResult For(string? payload, SvgOptions? route, string? cacheControl, bool checkRoute = false) =>
        new SvgResult(payload, route, cacheControl, checkRoute);

    /// <summary>500 with the error code only; the code and message are logged.</summary>
    public static IResult Error(TingQrException exception) => new ErrorResult(exception);

    private static bool IsBlank(string? value) => string.IsNullOrWhiteSpace(value);

    private sealed class SvgResult : IResult
    {
        private readonly string? _payload;
        private readonly SvgOptions? _route;
        private readonly string? _cacheControl;
        private readonly bool _checkRoute;

        public SvgResult(string? payload, SvgOptions? route, string? cacheControl, bool checkRoute)
        {
            _payload = payload;
            _route = route;
            _cacheControl = cacheControl;
            _checkRoute = checkRoute;
        }

        public Task ExecuteAsync(HttpContext httpContext)
        {
            if (string.IsNullOrEmpty(_payload))
            {
                return Results.NotFound().ExecuteAsync(httpContext);
            }
            // IOptions<TingQrOptions> resolves (with defaults) even without AddTingQr once options are registered; an
            // app without either gets the defaults too.
            var options = httpContext.RequestServices.GetService<IOptions<TingQrOptions>>()?.Value;
            string svg;
            try
            {
                if (_checkRoute)
                {
                    TingQrConfiguration.CheckRouteOptions(_route);
                }
                svg = TingQrRender.ToSvg(_payload, TingQrConfiguration.Merge(options?.Svg, _route));
            }
            catch (TingQrException e)
            {
                return Error(e).ExecuteAsync(httpContext);
            }
            var cacheControl = !IsBlank(_cacheControl) ? _cacheControl!
                : !IsBlank(options?.CacheControl) ? options!.CacheControl
                : DefaultCacheControl;
            var response = httpContext.Response;
            response.StatusCode = StatusCodes.Status200OK;
            response.ContentType = "image/svg+xml; charset=utf-8";
            response.Headers["X-Content-Type-Options"] = "nosniff";
            response.Headers["Content-Security-Policy"] = Csp;
            response.Headers.CacheControl = cacheControl;
            return response.WriteAsync(svg);
        }
    }

    private sealed class ErrorResult : IResult
    {
        private readonly TingQrException _exception;

        public ErrorResult(TingQrException exception)
        {
            _exception = exception;
        }

        public Task ExecuteAsync(HttpContext httpContext)
        {
            var code = _exception.Code.ToWireName();
            var logger = httpContext.RequestServices.GetService<ILoggerFactory>()?.CreateLogger(LogCategory);
            logger?.LogError(_exception, "{Code}: {Message}", code, _exception.Message);
            var response = httpContext.Response;
            response.StatusCode = StatusCodes.Status500InternalServerError;
            response.ContentType = "application/json; charset=utf-8";
            // Wire names are fixed upper-case ASCII, so the body needs no JSON escaping (and no app serializer options).
            return response.WriteAsync("{\"error\":{\"code\":\"" + code + "\"}}");
        }
    }
}
