namespace TingQR
{
    /// <summary>Builds app links (<c>linkFor</c> of ts/packages/core/src/banks/link.ts).</summary>
    internal static class BankAppLink
    {
        private static TingQrException Invalid(string message) => new TingQrException(TingQrErrorCode.InvalidValue, message);

        /// <summary>
        /// Android: <c>intent://&lt;host&gt;#Intent;scheme=..;package=..;[S.browser_fallback_url=..;]end</c>.
        /// iOS: <c>&lt;scheme&gt;://</c>. The fallback is checked before the platform's scheme, on both platforms.
        /// </summary>
        public static string For(BankApp? app, string? appId, AppPlatform platform, string? fallbackUrl)
        {
            if (app == null)
            {
                // Stryker disable once all : "shown" is only used in the error message
                var shown = appId == null ? "null" : "\"" + appId + "\"";
                // Stryker disable once String : error message
                throw Invalid($"unknown bank app {shown}.");
            }
            if (platform != AppPlatform.Android && platform != AppPlatform.Ios)
            {
                throw Invalid($"platform must be Android or Ios, got {(int)platform}.");
            }
            var fallback = fallbackUrl == null ? null : FallbackUrl.EncodeUriComponent(FallbackUrl.Normalize(fallbackUrl));
            if (platform == AppPlatform.Ios)
            {
                if (app.Ios == null) throw Invalid($"{app.Id} has no known ios scheme.");
                return app.Ios.Scheme + "://";
            }
            var a = app.Android ?? throw Invalid($"{app.Id} has no known android scheme.");
            var tail = fallback == null ? "" : "S.browser_fallback_url=" + fallback + ";";
            return "intent://" + a.Host + "#Intent;scheme=" + a.Scheme + ";package=" + a.Package + ";" + tail + "end";
        }
    }
}
