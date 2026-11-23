using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace TingQR.Rendering
{
    /// <summary>An immutable QR module matrix, as returned by <see cref="TingQrRender.ToMatrix"/>.</summary>
    public sealed class QrMatrix
    {
        private readonly bool[][] _rows;

        internal QrMatrix(int version, Ecc ecc, int mask, bool[][] rows)
        {
            Version = version;
            Ecc = ecc;
            Mask = mask;
            Size = rows.Length;
            _rows = rows;
            var wrapped = new IReadOnlyList<bool>[rows.Length];
            for (var y = 0; y < rows.Length; y++)
            {
                wrapped[y] = Array.AsReadOnly(rows[y]);
            }
            Modules = Array.AsReadOnly(wrapped);
        }

        /// <summary>Modules per side: 4 × version + 17.</summary>
        public int Size { get; }

        /// <summary>QR version, 1–40.</summary>
        public int Version { get; }

        /// <summary>The ECC level actually used (may be higher than requested when boostEcc is on).</summary>
        public Ecc Ecc { get; }

        /// <summary>Mask pattern used, 0–7.</summary>
        public int Mask { get; }

        /// <summary>Modules[y][x]; true is a dark module. Read-only.</summary>
        public IReadOnlyList<IReadOnlyList<bool>> Modules { get; }

        /// <summary>Whether the module at column <paramref name="x"/>, row <paramref name="y"/> is dark; false outside the matrix.</summary>
        public bool IsDark(int x, int y) => 0 <= x && x < Size && 0 <= y && y < Size && _rows[y][x];
    }
}
