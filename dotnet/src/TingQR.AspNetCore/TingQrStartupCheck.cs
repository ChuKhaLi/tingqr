using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace TingQR.AspNetCore;

/// <summary>
/// Checks the tingqr configuration when the host starts, so a <see cref="TingQrException"/> stops the app at startup (it
/// reaches the caller of <c>StartAsync</c>/<c>Run</c> as thrown, not wrapped in an options exception).
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
        _services.GetRequiredService<ResolvedTingQr>();
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
