namespace TingQR
{
    /// <summary>A bank or wallet app that can be opened by URL scheme (conformance/banks/bank-apps.json).</summary>
    /// <param name="Id">App id, lower case, e.g. <c>mb</c>, <c>tcb</c>.</param>
    /// <param name="Name">App name.</param>
    /// <param name="Bin">BIN of the bank behind the app, or null.</param>
    /// <param name="Ios">The iOS URL scheme, or null when none is known.</param>
    /// <param name="Android">The Android intent parts, or null when none are known.</param>
    /// <param name="Confidence">How many independent sources agree on the scheme(s), package and host emitted here. Neither value means anyone opened the app.</param>
    /// <param name="VietqrAutofill">dl.vietqr.io can pre-fill amount and message for this app (per vietqr.io). tingqr itself only opens apps.</param>
    public sealed record BankApp(string Id, string Name, string? Bin, BankAppIos? Ios, BankAppAndroid? Android, BankAppConfidence Confidence, bool VietqrAutofill);

    /// <summary>How an app opens on iOS.</summary>
    /// <param name="Scheme">URL scheme; the link is <c>&lt;scheme&gt;://</c>.</param>
    public sealed record BankAppIos(string Scheme);

    /// <summary>How an app opens on Android.</summary>
    /// <param name="Package">Package name.</param>
    /// <param name="Scheme">Intent scheme.</param>
    /// <param name="Host">What goes between <c>intent://</c> and <c>#Intent</c> (often empty).</param>
    public sealed record BankAppAndroid(string Package, string Scheme, string Host);

    /// <summary>How well the data of a <see cref="BankApp"/> is sourced.</summary>
    public enum BankAppConfidence
    {
        /// <summary>At least two independent sources give exactly the scheme(s), package and host emitted here.</summary>
        MultiSource,

        /// <summary>Fewer than two independent sources agree.</summary>
        SingleSource,
    }

    /// <summary>The platform a bank-app link is built for.</summary>
    public enum AppPlatform
    {
        /// <summary>Android: an <c>intent://</c> link.</summary>
        Android,

        /// <summary>iOS: a <c>scheme://</c> link.</summary>
        Ios,
    }
}
