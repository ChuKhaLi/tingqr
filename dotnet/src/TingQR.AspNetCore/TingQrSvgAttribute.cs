using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.AspNetCore.Mvc.Filters;

namespace TingQR.AspNetCore;

/// <summary>
/// Serves the QR payload an MVC action returns (a string or null; also <c>Task&lt;string&gt;</c> and
/// <c>ActionResult&lt;string&gt;</c>) as an SVG image, with the contract of
/// <see cref="TingQrEndpointExtensions.WithTingQrSvg{TBuilder}"/>: 200 for every HTTP method, null or "" gives 404, a
/// <see cref="TingQrException"/> gives 500 with the error code only (the app's exception filters do not see it), other
/// exceptions reach the app unchanged, and a result of another type throws <see cref="InvalidOperationException"/>.
/// </summary>
/// <remarks>
/// Put it on an action or a controller. The nearest attribute wins as a whole (the action's over the controller's), and
/// each request is rendered once. Attribute arguments must be constants, so SVG options are named profiles set in
/// <c>AddTingQr</c> (<see cref="TingQrOptions.Profiles"/>); a profile name that is not there stops the app at startup.
/// </remarks>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
public sealed class TingQrSvgAttribute : Attribute, IFilterFactory, IControllerModelConvention, IActionModelConvention
{
    /// <summary>Serve with the app-wide <see cref="TingQrOptions.Svg"/> options.</summary>
    public TingQrSvgAttribute()
    {
    }

    /// <summary>Serve with the profile <paramref name="profile"/> of <see cref="TingQrOptions.Profiles"/>, merged over <see cref="TingQrOptions.Svg"/> key by key.</summary>
    /// <param name="profile">A key of <see cref="TingQrOptions.Profiles"/>.</param>
    public TingQrSvgAttribute(string profile)
    {
        Profile = profile;
    }

    /// <summary>The profile name, or null for the app-wide options only.</summary>
    public string? Profile { get; }

    /// <summary>
    /// Cache-Control header; null or blank means <see cref="TingQrOptions.CacheControl"/>, then "private, max-age=300".
    /// Printable ASCII only: a control or non-ASCII character stops the app at startup.
    /// </summary>
    public string? CacheControl { get; set; }

    /// <inheritdoc />
    public bool IsReusable => true;

    /// <inheritdoc />
    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider) => new TingQrSvgMvcFilter(this);

    /// <summary>Without AddTingQr there are no profiles: a profile name stops the app when the controllers are mapped.</summary>
    void IControllerModelConvention.Apply(ControllerModel controller) => CheckAtStartup(controller.Application, controller.ControllerType.Name);

    void IActionModelConvention.Apply(ActionModel action) =>
        CheckAtStartup(action.Controller?.Application, action.Controller?.ControllerType.Name + "." + action.ActionMethod.Name);

    /// <summary>A <see cref="CacheControl"/> that Kestrel would refuse on every request stops the app instead.</summary>
    internal void CheckCacheControl(string where) =>
        // Stryker disable once String : error message
        TingQrConfiguration.CheckCacheControl(CacheControl, "[TingQrSvg] on " + where + ": CacheControl");

    private void CheckAtStartup(ApplicationModel? application, string where)
    {
        CheckCacheControl(where);
        RequireAddTingQr(application, where);
    }

    internal string UnknownProfileMessage(string where) =>
        "AddTingQr: [TingQrSvg(\"" + Profile + "\")] on " + where + ": no profile \"" + Profile + "\" in AddTingQr Profiles";

    private void RequireAddTingQr(ApplicationModel? application, string where)
    {
        if (Profile is null || (application is not null && application.Properties.ContainsKey(TingQrMvcMarker.Key)))
        {
            return;
        }
        throw new TingQrException(TingQrErrorCode.InvalidValue, UnknownProfileMessage(where) + " (AddTingQr is not called).");
    }
}
