using TingQR.Rendering;

namespace TingQR.AspNetCore;

/// <summary>
/// tingqr settings for an ASP.NET Core app, set with
/// <see cref="TingQrServiceCollectionExtensions.AddTingQr(Microsoft.Extensions.DependencyInjection.IServiceCollection, System.Action{TingQrOptions}?)"/>.
/// Everything is checked when the app starts: a mistake stops startup with a <see cref="TingQrException"/>.
/// </summary>
public sealed class TingQrOptions
{
    /// <summary>
    /// Bank of the receiving account: code or BIN, looked up with <see cref="Banks.Find"/> ("MB", "mb", "970422",
    /// "VCB"…). Set it together with <see cref="AccountNumber"/>, or leave both unset for an app without a receiving
    /// account (it can still serve other QR codes).
    /// </summary>
    public string? Bank { get; set; }

    /// <summary>Receiving account (or card) number.</summary>
    public string? AccountNumber { get; set; }

    /// <summary>Account (default) or card, as <see cref="VietQrInput.Service"/>.</summary>
    public VietQrServiceCode Service { get; set; } = VietQrServiceCode.Account;

    /// <summary>
    /// SVG options for every served QR code. With a receiving account they are checked at startup by rendering its
    /// static code, which also catches a logo too big for that code. A logo must be a <c>data:image/</c> URI.
    /// </summary>
    public SvgOptions? Svg { get; set; }

    /// <summary>
    /// Named SVG options that a route can pick; they override <see cref="Svg"/> key by key (a logo replaces the whole
    /// logo). Checked at startup; a foreground set without a background is checked as a colour only, because its
    /// contrast depends on <see cref="Svg"/>.
    /// </summary>
    public IDictionary<string, SvgOptions> Profiles { get; } = new Dictionary<string, SvgOptions>(StringComparer.Ordinal);

    /// <summary>
    /// Cache-Control header of served QR codes; default "private, max-age=300". A payment QR carries an account number
    /// and often an amount, so shared caches (CDNs) must not keep it. Printable ASCII only: a control character (CR, LF,
    /// tab…) or a non-ASCII character stops the app at startup.
    /// </summary>
    public string CacheControl { get; set; } = "private, max-age=300";
}
