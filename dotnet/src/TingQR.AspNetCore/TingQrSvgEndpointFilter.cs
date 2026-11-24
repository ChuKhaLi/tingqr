using Microsoft.AspNetCore.Http;
using TingQR.Rendering;

namespace TingQR.AspNetCore;

/// <summary>Turns the payload an endpoint returns into an SVG response (see <see cref="SvgResponse"/>).</summary>
internal sealed class TingQrSvgEndpointFilter : IEndpointFilter
{
    private readonly SvgOptions? _options;
    private readonly string? _cacheControl;

    public TingQrSvgEndpointFilter(SvgOptions? options, string? cacheControl)
    {
        _options = options;
        _cacheControl = cacheControl;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        object? result;
        try
        {
            result = await next(context);
        }
        catch (TingQrException e)
        {
            return SvgResponse.Error(e);
        }
        return result switch
        {
            null => SvgResponse.For(null, _options, _cacheControl),
            string payload => SvgResponse.For(payload, _options, _cacheControl),
            _ => throw new InvalidOperationException(
                "A WithTingQrSvg endpoint must return a QR payload string or null; got " + result.GetType() + "."),
        };
    }
}
