using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;

namespace TingQR
{
    /// <summary>
    /// Vietnamese banks: <c>BANKS</c> and <c>findBank</c> of <c>@tingqr/core/banks</c>. Data: conformance/banks/,
    /// generated into BankData.g.cs.
    /// </summary>
    public static class Banks
    {
        /// <summary>Every bank of api.vietqr.io/v2/banks, sorted by BIN. Read-only; the records are immutable.</summary>
        public static IReadOnlyList<Bank> All { get; } = new ReadOnlyCollection<Bank>(BankData.Banks());

        /// <summary>
        /// Finds a bank by 6-digit BIN (exact), or else by vietqr.io code, then short name, ignoring case (invariant).
        /// No trimming: <c>" MB"</c> finds nothing. A code beats another bank's short name that spells the same.
        /// </summary>
        /// <param name="binOrCode">A BIN such as <c>970422</c>, or a code or short name such as <c>MB</c>, <c>mbbank</c>.</param>
        /// <returns>The bank, or null when nothing matches (or <paramref name="binOrCode"/> is null).</returns>
        public static Bank? Find(string? binOrCode) => FindIn(All, binOrCode);

        internal static Bank? FindIn(IReadOnlyList<Bank> banks, string? binOrCode)
        {
            if (binOrCode == null) return null;
            if (IsBin(binOrCode)) return banks.FirstOrDefault(b => b.Bin == binOrCode);
            var key = binOrCode.ToLowerInvariant();
            return banks.FirstOrDefault(b => b.Code.ToLowerInvariant() == key)
                ?? banks.FirstOrDefault(b => b.ShortName.ToLowerInvariant() == key);
        }

        // Exactly six ASCII digits (char.IsDigit would also take other scripts' digits).
        private static bool IsBin(string s) => s.Length == 6 && s.All(c => c >= '0' && c <= '9');
    }

    /// <summary>
    /// Bank and wallet apps that open by URL scheme: <c>BANK_APPS</c>, <c>findBankApp</c>, <c>appsForBank</c> and
    /// <c>bankAppLink</c> of <c>@tingqr/core/banks</c>.
    /// </summary>
    public static class BankApps
    {
        /// <summary>Every app tingqr can open, sorted by id. Read-only; the records are immutable.</summary>
        public static IReadOnlyList<BankApp> All { get; } = new ReadOnlyCollection<BankApp>(BankData.Apps());

        /// <summary>Finds an app by id, exactly (ids are lower case, e.g. <c>mb</c>, <c>tcb</c>).</summary>
        /// <param name="id">The app id.</param>
        /// <returns>The app, or null when none has that id.</returns>
        public static BankApp? Find(string? id) => All.FirstOrDefault(a => a.Id == id);

        /// <summary>Every app of the bank with this BIN, in <see cref="All"/> order; empty when it has none.</summary>
        /// <param name="bin">The bank's BIN.</param>
        /// <returns>A read-only list of apps.</returns>
        public static IReadOnlyList<BankApp> ForBank(string? bin)
            => new ReadOnlyCollection<BankApp>(All.Where(a => a.Bin == bin).ToList());

        /// <summary>
        /// The link that opens a bank app: <c>intent://…</c> on Android (with <c>S.browser_fallback_url</c> when
        /// <paramref name="fallbackUrl"/> is given), <c>scheme://</c> on iOS. It only opens the app; it does not
        /// pre-fill amount or message. iOS opens schemes only from a user tap.
        /// </summary>
        /// <param name="appId">The app id, exact (<c>"MB"</c> is unknown).</param>
        /// <param name="platform">The platform.</param>
        /// <param name="fallbackUrl">
        /// Absolute http(s) URL the browser opens when the app is not installed (Android). Validated on iOS too,
        /// where it is ignored.
        /// </param>
        /// <returns>The link.</returns>
        /// <exception cref="TingQrException">
        /// <c>INVALID_VALUE</c> for an unknown app, an undefined platform, a platform the app has no scheme for, or a
        /// <paramref name="fallbackUrl"/> that is not an absolute http(s) URL.
        /// </exception>
        public static string Link(string appId, AppPlatform platform, string? fallbackUrl = null)
            => BankAppLink.For(Find(appId), appId, platform, fallbackUrl);
    }
}
