using TingQR.Rendering;

namespace TingQR.AspNetCore;

/// <summary>The configuration after the startup check: bank resolved, profiles copied.</summary>
internal sealed class ResolvedTingQr
{
    public ResolvedTingQr(Bank? bank, string? accountNumber, VietQrServiceCode service, SvgOptions? svg,
        IReadOnlyDictionary<string, SvgOptions> profiles, string cacheControl)
    {
        Bank = bank;
        AccountNumber = accountNumber;
        Service = service;
        Svg = svg;
        Profiles = profiles;
        CacheControl = cacheControl;
    }

    /// <summary>The receiving bank; null when no account is configured.</summary>
    public Bank? Bank { get; }

    /// <summary>The receiving account; null when no account is configured.</summary>
    public string? AccountNumber { get; }

    public VietQrServiceCode Service { get; }

    public SvgOptions? Svg { get; }

    public IReadOnlyDictionary<string, SvgOptions> Profiles { get; }

    public string CacheControl { get; }
}

/// <summary>Startup checks of <see cref="TingQrOptions"/> and route options (rules of conformance/http/svg-response.json).</summary>
internal static class TingQrConfiguration
{
    private const string DataImage = "data:image/";

    /// <summary>
    /// Check the whole configuration so a mistake stops the app at startup, not at the first request: the bank must be
    /// known, the account must make a valid VietQR, and the SVG options and profiles must render.
    /// </summary>
    public static ResolvedTingQr Resolve(TingQrOptions options)
    {
        var hasBank = !string.IsNullOrEmpty(options.Bank);
        var hasAccount = !string.IsNullOrEmpty(options.AccountNumber);
        if (hasBank != hasAccount)
        {
            var missing = hasBank ? nameof(TingQrOptions.AccountNumber) : nameof(TingQrOptions.Bank);
            // Stryker disable once all : "present" is only used in the error message
            var present = hasBank ? nameof(TingQrOptions.Bank) : nameof(TingQrOptions.AccountNumber);
            // Stryker disable once String : error message
            throw new TingQrException(TingQrErrorCode.InvalidValue,
                "AddTingQr: " + present + " is set but " + missing + " is missing; set both for a receiving account, or neither.");
        }

        Bank? bank = null;
        string? account = null;
        string? staticCode = null;
        if (hasBank)
        {
            account = options.AccountNumber;
            bank = Banks.Find(options.Bank!);
            if (bank is null)
            {
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    "AddTingQr: bank \"" + options.Bank + "\" is not a known bank code or BIN (e.g. 'MB', 'VCB', '970422').");
            }
            // The static code of the account: an invalid account or service throws the Core error here.
            staticCode = VietQr.Encode(new VietQrInput { BankBin = bank.Bin, AccountNumber = options.AccountNumber!, Service = options.Service });
        }

        CheckCacheControl(options.CacheControl, "AddTingQr: CacheControl");
        CheckServedLogo(options.Svg);
        if (options.Svg is not null)
        {
            if (staticCode is not null)
            {
                TingQrRender.ToSvg(staticCode, options.Svg);
            }
            else
            {
                TingQrRender.CheckSvgOptions(options.Svg);
            }
        }

        var profiles = new Dictionary<string, SvgOptions>(StringComparer.Ordinal);
        foreach (var pair in options.Profiles)
        {
            if (string.IsNullOrEmpty(pair.Key))
            {
                // Stryker disable once String : error message
                throw new TingQrException(TingQrErrorCode.InvalidValue, "AddTingQr: a profile name must not be empty.");
            }
            if (pair.Value is null)
            {
                // Stryker disable once String : error message
                throw new TingQrException(TingQrErrorCode.InvalidValue, "AddTingQr: profile \"" + pair.Key + "\" is null.");
            }
            CheckRouteOptions(pair.Value);
            profiles.Add(pair.Key, pair.Value);
        }

        return new ResolvedTingQr(bank, account, options.Service, options.Svg, profiles, options.CacheControl);
    }

    /// <summary>
    /// Check options set for one route, which are merged over the app-wide <see cref="TingQrOptions.Svg"/> per request.
    /// A route foreground set without a route background is checked as a colour only, because its contrast depends on the
    /// app-wide background. (A route background alone is checked against black, the darkest foreground, so that check
    /// holds for any app-wide options.)
    /// </summary>
    public static void CheckRouteOptions(SvgOptions? options)
    {
        if (options is null)
        {
            return;
        }
        CheckServedLogo(options);
        var routeOnly = options.Foreground is not null && options.Background is null;
        TingQrRender.CheckSvgOptions(routeOnly ? options with { Background = "transparent" } : options);
    }

    /// <summary>
    /// Route options over app-wide options, key by key (the encoding options of <see cref="MatrixOptions"/> too): a route
    /// value that is not null wins. A route <see cref="SvgOptions.Logo"/> replaces the whole app-wide logo.
    /// </summary>
    public static SvgOptions? Merge(SvgOptions? appWide, SvgOptions? route)
    {
        if (route is null)
        {
            return appWide;
        }
        if (appWide is null)
        {
            return route;
        }
        return new SvgOptions
        {
            Ecc = route.Ecc ?? appWide.Ecc,
            BoostEcc = route.BoostEcc ?? appWide.BoostEcc,
            MinVersion = route.MinVersion ?? appWide.MinVersion,
            MaxVersion = route.MaxVersion ?? appWide.MaxVersion,
            Mask = route.Mask ?? appWide.Mask,
            Margin = route.Margin ?? appWide.Margin,
            Foreground = route.Foreground ?? appWide.Foreground,
            Background = route.Background ?? appWide.Background,
            Size = route.Size ?? appWide.Size,
            Logo = route.Logo ?? appWide.Logo,
        };
    }

    /// <summary>
    /// A Cache-Control value is sent as a header as is: Kestrel refuses a control character (CR, LF, tab…) or a non-ASCII
    /// character when it writes the header, i.e. on every request. Refuse it here, where it is configured, instead.
    /// Null (not set) passes; blank values fall back to the default where they are used.
    /// </summary>
    /// <param name="value">The value to check.</param>
    /// <param name="what">Where the value comes from, for the message (e.g. "AddTingQr: CacheControl").</param>
    public static void CheckCacheControl(string? value, string what)
    {
        if (value is null)
        {
            return;
        }
        foreach (var c in value)
        {
            if (c < ' ' || c > '~')
            {
                // Stryker disable once String : error message
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    what + " must contain only printable ASCII characters (no CR, LF or other control characters).");
            }
        }
    }

    /// <summary>
    /// An SVG used as an image never loads outside resources (and the response CSP allows only data: images), so a path
    /// or URL logo would be served as an empty square. Never serve a code without the logo that was asked for.
    /// </summary>
    private static void CheckServedLogo(SvgOptions? options)
    {
        var logo = options?.Logo;
        if (logo is null)
        {
            return;
        }
        if (logo.Href is null || !logo.Href.StartsWith(DataImage, StringComparison.Ordinal))
        {
            // Stryker disable once String : error message
            throw new TingQrException(TingQrErrorCode.InvalidValue,
                "A logo in an SVG served over HTTP must be a data:image/ URI (e.g. from TingQR.BankLogos): an SVG shown as an " +
                "image cannot load a path or URL, so the logo would be blank.");
        }
    }
}
