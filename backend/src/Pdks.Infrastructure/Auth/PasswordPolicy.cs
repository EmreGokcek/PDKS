using System.Security.Cryptography;

namespace Pdks.Infrastructure.Auth;

public static class PasswordPolicy
{
    public const int MinLength = 8;

    /// <summary>En az 8 karakter, en az bir harf ve bir rakam.</summary>
    public static bool IsValid(string? password) =>
        password is { Length: >= MinLength }
        && password.Any(char.IsLetter)
        && password.Any(char.IsDigit);

    // Karıştırılabilecek karakterler (0/O, 1/l/I) çıkarıldı; telefonda okuyup yazması kolay olsun.
    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnopqrstuvwxyz";
    private const string Digits = "23456789";

    /// <summary>"Kx7m-Pq3r" biçiminde, okunması kolay geçici şifre üretir.</summary>
    public static string GenerateTemporary()
    {
        char Pick(string set) => set[RandomNumberGenerator.GetInt32(set.Length)];

        string Group() => string.Concat(Pick(Upper), Pick(Lower), Pick(Digits), Pick(Lower));

        return $"{Group()}-{Group()}";
    }
}
