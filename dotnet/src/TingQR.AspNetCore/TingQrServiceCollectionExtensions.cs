using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace TingQR.AspNetCore;

/// <summary>Registers tingqr in an ASP.NET Core app.</summary>
public static class TingQrServiceCollectionExtensions
{
    /// <summary>
    /// Registers <see cref="TingQrService"/> and the startup check of <see cref="TingQrOptions"/>: an unknown bank, an
    /// invalid account or bad SVG options stop the app at startup with a <see cref="TingQrException"/>.
    /// </summary>
    /// <param name="services">The app's services.</param>
    /// <param name="configure">Sets the options; may be called again to add to them.</param>
    public static IServiceCollection AddTingQr(this IServiceCollection services, Action<TingQrOptions>? configure = null)
    {
        if (services is null)
        {
            throw new ArgumentNullException(nameof(services));
        }
        services.AddOptions<TingQrOptions>();
        if (configure is not null)
        {
            services.Configure(configure);
        }
        services.TryAddSingleton(sp => TingQrConfiguration.Resolve(sp.GetRequiredService<IOptions<TingQrOptions>>().Value));
        services.TryAddSingleton(sp => new TingQrService(sp.GetRequiredService<ResolvedTingQr>()));
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IHostedService, TingQrStartupCheck>());
        return services;
    }

    /// <summary>
    /// Like <see cref="AddTingQr(IServiceCollection, Action{TingQrOptions}?)"/>, reading <c>Bank</c>,
    /// <c>AccountNumber</c>, <c>Service</c> ("account" or "card", any case) and <c>CacheControl</c> from a configuration
    /// section (e.g. <c>builder.Configuration.GetSection("TingQr")</c>) before <paramref name="configure"/> runs.
    /// <see cref="TingQrOptions.Svg"/> and <see cref="TingQrOptions.Profiles"/> are set in code only.
    /// </summary>
    /// <param name="services">The app's services.</param>
    /// <param name="section">The configuration section to read.</param>
    /// <param name="configure">Sets more options after the section is read.</param>
    public static IServiceCollection AddTingQr(this IServiceCollection services, IConfiguration section, Action<TingQrOptions>? configure = null)
    {
        if (section is null)
        {
            throw new ArgumentNullException(nameof(section));
        }
        return services.AddTingQr(options =>
        {
            Bind(section, options);
            configure?.Invoke(options);
        });
    }

    /// <summary>Lower-cases ASCII letters only: no culture or Unicode case folding, as everywhere in tingqr.</summary>
    private static string AsciiLower(string text)
    {
        var chars = text.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            if (chars[i] >= 'A' && chars[i] <= 'Z')
            {
                chars[i] = (char)(chars[i] + ('a' - 'A'));
            }
        }
        return new string(chars);
    }

    private static void Bind(IConfiguration section, TingQrOptions options)
    {
        var bank = section[nameof(TingQrOptions.Bank)];
        if (bank is not null)
        {
            options.Bank = bank;
        }
        var account = section[nameof(TingQrOptions.AccountNumber)];
        if (account is not null)
        {
            options.AccountNumber = account;
        }
        var service = section[nameof(TingQrOptions.Service)];
        if (service is not null)
        {
            options.Service = AsciiLower(service) switch
            {
                "account" => VietQrServiceCode.Account,
                "card" => VietQrServiceCode.Card,
                _ => throw new TingQrException(TingQrErrorCode.InvalidValue,
                    "AddTingQr: Service \"" + service + "\" in configuration must be \"account\" or \"card\"."),
            };
        }
        var cacheControl = section[nameof(TingQrOptions.CacheControl)];
        if (cacheControl is not null)
        {
            options.CacheControl = cacheControl;
        }
    }
}
