namespace TingQR
{
    /// <summary>Who receives a PromptPay payment. Exactly one recipient; the cases are the nested records.</summary>
    public abstract record PromptPayTarget
    {
        private PromptPayTarget()
        {
        }

        /// <summary>Thai mobile number: <c>0812223333</c>, <c>+66 81-222-3333</c>, <c>66812223333</c>; non-digits are removed.</summary>
        /// <param name="Number">The mobile number as the caller has it.</param>
        public sealed record Mobile(string Number) : PromptPayTarget;

        /// <summary>National ID or tax ID: exactly 13 digits.</summary>
        /// <param name="Id">The 13-digit ID.</param>
        public sealed record NationalId(string Id) : PromptPayTarget;

        /// <summary>E-wallet ID: exactly 15 digits.</summary>
        /// <param name="Id">The 15-digit ID.</param>
        public sealed record EWallet(string Id) : PromptPayTarget;

        /// <summary>Bill payment: biller ID of 13 or 15 digits; references are printable ASCII, at most 20 characters.</summary>
        /// <param name="BillerId">The 13- or 15-digit biller ID.</param>
        /// <param name="Reference1">Reference 1 (tag 30.02); null or empty for none.</param>
        /// <param name="Reference2">Reference 2 (tag 30.03); null or empty for none.</param>
        public sealed record Bill(string BillerId, string? Reference1 = null, string? Reference2 = null) : PromptPayTarget;
    }
}
