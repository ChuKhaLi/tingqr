namespace TingQR.Rendering
{
    /// <summary>Options for <see cref="TingQrRender.ToMatrix"/>. A null property means the default.</summary>
    public record MatrixOptions
    {
        /// <summary>Error correction level; default <see cref="Rendering.Ecc.M"/>.</summary>
        public Ecc? Ecc { get; init; }

        /// <summary>Raise the ECC level while the data still fits the same version (Nayuki's boostEcl); default true.</summary>
        public bool? BoostEcc { get; init; }

        /// <summary>Smallest QR version to use, 1–40; default 1.</summary>
        public int? MinVersion { get; init; }

        /// <summary>Largest QR version to use, 1–40; default 40.</summary>
        public int? MaxVersion { get; init; }

        /// <summary>Mask pattern 0–7; chosen automatically when null.</summary>
        public int? Mask { get; init; }
    }
}
