using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Xunit;

namespace TingQR.AspNetCore.Tests;

/// <summary>The HTTP contract of conformance/http/svg-response.json, read from the file (no values copied by hand).</summary>
internal static class Contract
{
    private static readonly JsonElement Root =
        JsonDocument.Parse(File.ReadAllText(Path.Combine(ConformanceRoot.Path, "http", "svg-response.json"))).RootElement;

    public static int SuccessStatus => Root.GetProperty("success").GetProperty("status").GetInt32();

    public static int TingQrErrorStatus => Root.GetProperty("tingQrError").GetProperty("status").GetInt32();

    public static IReadOnlyDictionary<string, string> SuccessHeaders { get; } =
        Root.GetProperty("success").GetProperty("headers").EnumerateObject().ToDictionary(p => p.Name, p => p.Value.GetString()!);

    public static string DefaultCacheControl => SuccessHeaders["Cache-Control"];

    /// <summary>Payload of a conformance vector, e.g. ("vietqr", "vietqr-static-account").</summary>
    public static string Payload(string scheme, string id) => Vector(scheme, id).GetProperty("payload").GetString()!;

    public static JsonElement Vector(string scheme, string id) =>
        JsonDocument.Parse(File.ReadAllText(Path.Combine(ConformanceRoot.Path, "vectors", scheme, id + ".json"))).RootElement;

    /// <summary>conformance/vectors/vietqr/vietqr-static-account.json (fake account).</summary>
    public static string VietQr => Payload("vietqr", "vietqr-static-account");

    /// <summary>conformance/vectors/promptpay/promptpay-encode-mobile.json.</summary>
    public static string PromptPay => Payload("promptpay", "promptpay-encode-mobile");

    /// <summary>A header as sent (not re-formatted by HttpClient's parsers, which reorder Cache-Control directives).</summary>
    public static string? Header(HttpResponseMessage response, string name)
    {
        if (response.Headers.NonValidated.TryGetValues(name, out var values) || response.Content.Headers.NonValidated.TryGetValues(name, out values))
        {
            return string.Join(", ", values);
        }
        return null;
    }

    /// <summary>Asserts a 200 SVG response with every contract header (Cache-Control as given) and the expected body.</summary>
    public static async Task AssertSvg(HttpResponseMessage response, string expectedBody, string? cacheControl = null)
    {
        Assert.Equal(SuccessStatus, (int)response.StatusCode);
        foreach (var pair in SuccessHeaders)
        {
            var expected = pair.Key == "Cache-Control" && cacheControl is not null ? cacheControl : pair.Value;
            Assert.Equal(expected, Header(response, pair.Key));
        }
        Assert.Equal(expectedBody, await response.Content.ReadAsStringAsync());
    }

    /// <summary>Asserts the contract's TingQrError response: status 500 and a JSON body with the code only.</summary>
    public static async Task AssertError(HttpResponseMessage response, string code)
    {
        Assert.Equal(TingQrErrorStatus, (int)response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("{\"error\":{\"code\":\"" + code + "\"}}", await response.Content.ReadAsStringAsync());
    }

    /// <summary>
    /// The app's own exception handler: 418 with the exception type and message, so a test can see what reached it.
    /// </summary>
    public static void UseTeapotExceptionHandler(this WebApplication app)
    {
        app.UseExceptionHandler(handler => handler.Run(async context =>
        {
            var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
            context.Response.StatusCode = 418;
            await context.Response.WriteAsync(error?.GetType().Name + ": " + error?.Message);
        }));
    }
}

/// <summary>Collects log entries in memory.</summary>
internal sealed class CapturingLoggerProvider : ILoggerProvider
{
    public ConcurrentQueue<(string Category, LogLevel Level, string Message, Exception? Exception)> Entries { get; } = new();

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(this, categoryName);

    public void Dispose()
    {
    }

    private sealed class CapturingLogger : ILogger
    {
        private readonly CapturingLoggerProvider _provider;
        private readonly string _category;

        public CapturingLogger(CapturingLoggerProvider provider, string category)
        {
            _provider = provider;
            _category = category;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            _provider.Entries.Enqueue((_category, logLevel, formatter(state, exception), exception));
    }
}
