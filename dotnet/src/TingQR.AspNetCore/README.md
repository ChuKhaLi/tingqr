# TingQR.AspNetCore

ASP.NET Core integration for [tingqr](https://github.com/ChuKhaLi/tingqr): configure the receiving account once, build
VietQR codes with `TingQrService`, and serve any QR code (VietQR, PromptPay, KHQR…) as SVG from your own Minimal API
endpoints or MVC controllers. No network calls. Targets `net10.0`.

> tingqr does **not** confirm payments or receive webhooks. It only builds, reads and draws QR codes.
>
> **Not released yet.** Version `0.0.0`, not on NuGet. See the
> [repository README](https://github.com/ChuKhaLi/tingqr#readme) for status and for which codes have been scanned with
> real banking apps.

```sh
dotnet add package TingQR.AspNetCore
dotnet add package TingQR.BankLogos   # optional: bank logos for the middle of the code
```

## Configure the receiving account

```csharp
using TingQR.AspNetCore;

builder.Services.AddTingQr(o =>
{
    o.Bank = "MB";
    o.AccountNumber = "0123456789";
});
```

From configuration (`appsettings.json`, environment variables `TingQr__Bank`…):

```json
{
  "TingQr": {
    "Bank": "MB",
    "AccountNumber": "0123456789",
    "Service": "account",
    "CacheControl": "private, max-age=300"
  }
}
```

```csharp
builder.Services.AddTingQr(builder.Configuration.GetSection("TingQr"), o =>
{
    o.Svg = new SvgOptions { Margin = 2 };   // SVG options and profiles are set in code only
});
```

- `Bank`: a bank code or BIN (`"MB"`, `"vcb"`, `"970422"`…), looked up with `Banks.Find` of `TingQR.Core`. Set it
  together with `AccountNumber`, or leave both unset for an app that only serves other codes.
- `Service`: `account` (default) or `card`. `Svg`: default image options for every served code. `Profiles`: named
  image options for `[TingQrSvg("name")]` (see [MVC](#mvc-tingqrsvg-and-profiles)). `CacheControl`: see
  [headers](#responses-and-headers).
- **The configuration is checked when the app starts.** An unknown bank, an invalid account, only one of
  `Bank`/`AccountNumber`, a logo that is not a `data:image/` URI, `Svg` options that cannot render the account's static
  code (colours, margin, logo size…), or a bad profile stop the app with a `TingQrException` (`InvalidValue`). Options
  that depend on the payload length (`MaxVersion`) are only checked per request (500).

## Build a code

```csharp
app.MapGet("/pay", (TingQrService tingqr) => tingqr.PaymentQr(50000L, "ORDER A1")); // VietQR string
```

Without an amount you get a static code. A purpose with Vietnamese accents throws `TingQrException` (`NonAscii`): banking
apps reject it. Without a configured account, `PaymentQr` throws `TingQrException` (`InvalidValue`). `tingqr.Bin` and
`tingqr.Bank` give the configured bank (null without an account).

## Serve the QR as an image

### Minimal API: `WithTingQrSvg`

```csharp
app.MapGet("/orders/{id}/qr.svg", async (string id, OrderStore orders, TingQrService tingqr) =>
{
    var order = await orders.FindPendingAsync(id);
    return order is null ? null : tingqr.PaymentQr(order.Amount, order.Code);
}).WithTingQrSvg();
```

- The handler returns `string?` (sync, `Task<string?>` or `ValueTask<string?>`). Any other result type throws
  `InvalidOperationException` (a programming error).
- `WithTingQrSvg(options, cacheControl)` takes the `SvgOptions` of `TingQR.Rendering`, merged over `AddTingQr`'s `Svg`
  key by key. They are checked right there, so a bad colour, margin, size or logo stops the app at startup.

### Minimal API: `TingQrHttpResults.Svg`

For handlers that decide the response themselves:

```csharp
app.MapGet("/orders/{id}/qr.svg", async (string id, OrderStore orders, TingQrService tingqr) =>
{
    var order = await orders.FindPendingAsync(id);
    if (order is null)
    {
        return Results.NotFound();
    }
    return TingQrHttpResults.Svg(tingqr.PaymentQr(order.Amount, order.Code));
});
```

`TingQrHttpResults.Svg(payload, options, cacheControl)` never throws: it runs per request, so bad options give a 500
(code only, message logged) instead of stopping the app. Prefer `WithTingQrSvg` when the options are fixed. It does not
catch exceptions from your own handler code (here `PaymentQr`); those go to your app's error handling.

### MVC: `[TingQrSvg]` and profiles

C# attribute arguments must be constants, so image options (for example a logo from `TingQR.BankLogos`, read at run
time) are named profiles in `AddTingQr`; the attribute names the profile.

```csharp
using TingQR;
using TingQR.AspNetCore;
using TingQR.Rendering;

builder.Services.AddControllers();
builder.Services.AddTingQr(o =>
{
    o.Bank = "MB";
    o.AccountNumber = "0123456789";
    o.Profiles["mb"] = new SvgOptions { Logo = new LogoOptions { Href = BankLogos.Icon("mb")! } };
});

[ApiController, Route("orders")]
public class OrdersController(OrderStore orders, TingQrService tingqr) : ControllerBase
{
    [HttpGet("{id}/qr.svg"), TingQrSvg("mb")]
    public async Task<string?> Qr(string id)
    {
        var order = await orders.FindPendingAsync(id);
        return order is null ? null : tingqr.PaymentQr(order.Amount, order.Code);
    }
}
```

- The action returns `string?`, also as `Task<string?>` or `ActionResult<string?>`. Another result (an `int`, a
  `void` action, `NotFound()` from an `ActionResult<string>`) throws `InvalidOperationException`.
- `[TingQrSvg]` uses `AddTingQr`'s `Svg` only; `[TingQrSvg("mb")]` merges the profile over `Svg` key by key (a profile
  logo replaces the whole logo). `[TingQrSvg(CacheControl = "no-store")]` sets the header.
- Put it on an action or a controller. The nearest attribute wins as a whole: an action's `[TingQrSvg("b")]` replaces
  the controller's `[TingQrSvg("a")]` (nothing of `a` is used). Each request is rendered once.
- **Profile names are checked at startup:** a name not in `Profiles` stops the app with a `TingQrException` naming the
  controller, action and profile (also on a controller attribute that every action overrides).
- Profiles are checked on their own at startup. A profile `Foreground` without a profile `Background` is checked only as
  a colour, since its contrast depends on `Svg`'s background; a clash between the two (for example a `Svg` logo and a
  profile `Ecc = Ecc.L`) is found per request (500).
- `[TingQrSvg]` works without `AddTingQr` (e.g. to serve PromptPay codes); `[TingQrSvg("name")]` then stops the app,
  since there are no profiles.

## Responses and headers

Minimal API (`WithTingQrSvg`, `TingQrHttpResults.Svg`) and MVC (`[TingQrSvg]`) follow the same contract, shared with
`@tingqr/hono` and `@tingqr/nestjs` (`conformance/http/svg-response.json`):

| The handler or action returns | Response |
|---|---|
| a non-empty string (not validated: build it with tingqr's encoders, e.g. `PaymentQr`) | `200`, SVG, whatever the method (also `POST`) |
| `null` or `""` | `404` (ASP.NET Core's default body) |
| throws a `TingQrException`, or the string / options cannot be drawn | `500`, body `{"error":{"code":"…"}}` only; the code and message are logged |
| throws anything else | unchanged: your exception handler or MVC exception filters decide |

- **A served SVG is always `200`.** ASP.NET Core has no per-route status attribute like NestJS's `@HttpCode()`, so
  there is no explicit status to keep (the shared contract keeps one only for NestJS).
- Your app builds the payload, so a `TingQrException` is a server-side mistake (for example a misconfigured account):
  its message may describe your configuration, so it goes to the log (`ILogger`, category
  `TingQR.AspNetCore.TingQrSvg`, level Error), never to the client. The 500 is written directly: `UseExceptionHandler`
  and MVC exception filters do not see it. If you build a QR from client input and want a `400`, validate or encode that
  input in the handler and answer `400` yourself; errors from drawing the string you return (too long, a logo too big)
  are always `500`.
- Image headers: `Content-Type: image/svg+xml; charset=utf-8`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'`, and
  `Cache-Control: private, max-age=300` (the code carries an account number and often an amount, so shared caches must
  not keep it). Change `Cache-Control` per route (`cacheControl`, `CacheControl = …`) or app-wide
  (`TingQrOptions.CacheControl`); null or blank falls back to the next level, then to the default.
- A logo must be a `data:image/` URI (e.g. from `TingQR.BankLogos`): an SVG shown as an image cannot load a path or
  URL, so other logos are rejected at startup (`WithTingQrSvg`, `Svg`, profiles) or give a 500 (`TingQrHttpResults`).
- An SVG `<img>` may not be savable by long-press in chat apps' in-app browsers (not tested).

### Why there is no open `?acc=&bank=` endpoint

A route that builds a QR from query parameters lets anyone make a code for any account and amount on your domain, which
is what scammers need. Your handler always decides what goes into the code; never build it from URL or query
parameters.

## License

MIT.
