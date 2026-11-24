using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TingQR.Rendering;

namespace TingQR.AspNetCore;

/// <summary>Turns the payload a [TingQrSvg] action returns into an SVG response (see <see cref="SvgResponse"/>).</summary>
internal sealed class TingQrSvgMvcFilter : IAsyncActionFilter
{
    private readonly TingQrSvgAttribute _attribute;

    public TingQrSvgMvcFilter(TingQrSvgAttribute attribute)
    {
        _attribute = attribute;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!ReferenceEquals(Nearest(context.ActionDescriptor), _attribute))
        {
            // A controller attribute overridden by the action's: only the nearest one renders.
            await next();
            return;
        }
        var executed = await next();
        if (executed.Canceled)
        {
            // Another filter answered before the action ran.
            return;
        }
        if (executed.Exception is not null && !executed.ExceptionHandled)
        {
            if (executed.Exception is TingQrException e)
            {
                executed.Result = new HttpResultAdapter(SvgResponse.Error(e));
                executed.ExceptionHandled = true;
            }
            return;
        }
        if (!TryGetPayload(executed, out var payload))
        {
            throw new InvalidOperationException(
                "A [TingQrSvg] action must return a QR payload string or null (also as Task<string> or ActionResult<string>); got " +
                executed.Result?.GetType() + " from " + context.ActionDescriptor.DisplayName + ".");
        }
        executed.Result = new HttpResultAdapter(Respond(context.HttpContext, payload, context.ActionDescriptor));
    }

    /// <summary>The [TingQrSvg] of the narrowest scope on this action (action over controller over global).</summary>
    internal static TingQrSvgAttribute? Nearest(ActionDescriptor action)
    {
        TingQrSvgAttribute? nearest = null;
        var scope = int.MinValue;
        foreach (var descriptor in action.FilterDescriptors)
        {
            if (descriptor.Filter is TingQrSvgAttribute attribute && descriptor.Scope >= scope)
            {
                nearest = attribute;
                scope = descriptor.Scope;
            }
        }
        return nearest;
    }

    /// <summary>Name of an action in messages, e.g. "OrdersController.Qr".</summary>
    internal static string Describe(ActionDescriptor action) =>
        action is ControllerActionDescriptor controller
            ? controller.ControllerTypeInfo.Name + "." + controller.MethodInfo.Name
            : action.DisplayName ?? action.Id;

    private IResult Respond(HttpContext httpContext, string? payload, ActionDescriptor action)
    {
        SvgOptions? profile = null;
        if (_attribute.Profile is not null)
        {
            // Profiles are checked at startup; this covers a host that never ran the startup check.
            var resolved = httpContext.RequestServices.GetService<ResolvedTingQr>();
            if (resolved is null || !resolved.Profiles.TryGetValue(_attribute.Profile, out profile))
            {
                return SvgResponse.Error(new TingQrException(TingQrErrorCode.InvalidValue, _attribute.UnknownProfileMessage(Describe(action)) + "."));
            }
        }
        return SvgResponse.For(payload, profile, _attribute.CacheControl);
    }

    private static bool TryGetPayload(ActionExecutedContext executed, out string? payload)
    {
        payload = null;
        switch (executed.Result)
        {
            case ObjectResult { Value: null }:
                return true;
            case ObjectResult { Value: string text }:
                payload = text;
                return true;
            case EmptyResult or NoContentResult:
                // What MVC may make of null from an action declared to return a string.
                return ReturnsString(executed.ActionDescriptor);
            default:
                return false;
        }
    }

    private static bool ReturnsString(ActionDescriptor action)
    {
        if (action is not ControllerActionDescriptor controller)
        {
            return false;
        }
        var type = controller.MethodInfo.ReturnType;
        if (type.IsGenericType && (type.GetGenericTypeDefinition() == typeof(Task<>) || type.GetGenericTypeDefinition() == typeof(ValueTask<>)))
        {
            type = type.GetGenericArguments()[0];
        }
        if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(ActionResult<>))
        {
            type = type.GetGenericArguments()[0];
        }
        return type == typeof(string);
    }

    /// <summary>Runs an <see cref="IResult"/> as an MVC result.</summary>
    private sealed class HttpResultAdapter : IActionResult
    {
        private readonly IResult _result;

        public HttpResultAdapter(IResult result)
        {
            _result = result;
        }

        public Task ExecuteResultAsync(ActionContext context) => _result.ExecuteAsync(context.HttpContext);
    }
}

/// <summary>Marks the MVC application model of an app that called AddTingQr, so [TingQrSvg("name")] knows profiles exist.</summary>
internal sealed class TingQrMvcMarker : IApplicationModelConvention, IConfigureOptions<MvcOptions>
{
    public static readonly object Key = typeof(TingQrMvcMarker);

    public void Apply(ApplicationModel application) => application.Properties[Key] = true;

    public void Configure(MvcOptions options) => options.Conventions.Add(this);
}
