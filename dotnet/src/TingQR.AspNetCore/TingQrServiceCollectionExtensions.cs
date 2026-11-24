using Microsoft.AspNetCore.Mvc;
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
        // Stryker disable once Statement : equivalent, AddOptions below throws the same ArgumentNullException("services")
        ArgumentNullException.ThrowIfNull(services);
        services.AddOptions<TingQrOptions>();
        if (configure is not null)
        {
            services.Configure(configure);
        }
        services.TryAddSingleton(sp => TingQrConfiguration.Resolve(sp.GetRequiredService<IOptions<TingQrOptions>>().Value));
        services.TryAddSingleton(sp => new TingQrService(sp.GetRequiredService<ResolvedTingQr>()));
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IHostedService, TingQrStartupCheck>());
        // Lets [TingQrSvg("name")] tell, when MVC builds its actions, that profiles may exist (checked at startup).
        services.TryAddEnumerable(ServiceDescriptor.Singleton<IConfigureOptions<MvcOptions>, TingQrMvcMarker>());
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

    /// <summary>
    /// Whether <paramref name="text"/> is <paramref name="word"/> (lower-case ASCII letters) in any ASCII case: no culture
    /// or Unicode case folding, as everywhere in tingqr.
    /// </summary>
    private static bool IsWord(string text, string word)
    {
        if (text.Length != word.Length)
        {
            return false;
        }
        for (var i = 0; i < text.Length; i++)
        {
            // Setting bit 0x20 turns 'A'..'Z' into 'a'..'z' and maps no other character onto a lower-case letter.
            if ((text[i] | 0x20) != word[i])
            {
                return false;
            }
        }
        return true;
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
            if (IsWord(service, "account"))
            {
                options.Service = VietQrServiceCode.Account;
            }
            else if (IsWord(service, "card"))
            {
                options.Service = VietQrServiceCode.Card;
            }
            else
            {
                // Stryker disable once String : error message
                throw new TingQrException(TingQrErrorCode.InvalidValue,
                    "AddTingQr: Service \"" + service + "\" in configuration must be \"account\" or \"card\".");
            }
        }
        var cacheControl = section[nameof(TingQrOptions.CacheControl)];
        if (cacheControl is not null)
        {
            options.CacheControl = cacheControl;
        }
    }
}
