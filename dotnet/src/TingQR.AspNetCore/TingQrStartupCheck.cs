using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace TingQR.AspNetCore;

/// <summary>
/// Checks the tingqr configuration when the host starts, so a <see cref="TingQrException"/> stops the app at startup (it
/// reaches the caller of <c>StartAsync</c>/<c>Run</c> as thrown, not wrapped in an options exception). In an MVC app it
/// also checks that every <see cref="TingQrSvgAttribute.Profile"/> names a configured profile.
/// </summary>
internal sealed class TingQrStartupCheck : IHostedService
{
    private readonly IServiceProvider _services;

    public TingQrStartupCheck(IServiceProvider services)
    {
        _services = services;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        // Resolving runs TingQrConfiguration.Resolve once; TingQrService shares the result.
        var resolved = _services.GetRequiredService<ResolvedTingQr>();
        var actions = _services.GetService<IActionDescriptorCollectionProvider>();
        if (actions is not null)
        {
            foreach (var action in actions.ActionDescriptors.Items)
            {
                // Controller and global attributes too, also those every action overrides: a name that is not there is a
                // mistake.
                foreach (var attribute in action.FilterDescriptors.Select(d => d.Filter).OfType<TingQrSvgAttribute>())
                {
                    attribute.CheckCacheControl(TingQrSvgMvcFilter.Describe(action));
                    if (attribute.Profile is not null && !resolved.Profiles.ContainsKey(attribute.Profile))
                    {
                        throw new TingQrException(TingQrErrorCode.InvalidValue,
                            attribute.UnknownProfileMessage(TingQrSvgMvcFilter.Describe(action)) + ".");
                    }
                }
            }
        }
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
