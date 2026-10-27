using System.Security.Cryptography;
using Pdks.Infrastructure.Attendance;

namespace Pdks.Tests;

public class KioskQrTokensTests
{
    private sealed class FakeTime(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private static readonly string Secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    private static readonly Guid KioskId = Guid.NewGuid();

    [Fact]
    public void Fresh_token_is_valid()
    {
        var tokens = new KioskQrTokens(new FakeTime(DateTimeOffset.UtcNow));
        var (token, _) = tokens.Create(KioskId, Secret);

        var parsed = KioskQrTokens.Parse(token);
        Assert.NotNull(parsed);
        Assert.Equal(KioskId, parsed.KioskId);
        Assert.Equal(KioskQrTokens.Result.Valid, tokens.Verify(parsed, Secret));
    }

    [Fact]
    public void Previous_window_is_accepted_but_older_is_expired()
    {
        var clock = new FakeTime(DateTimeOffset.FromUnixTimeSeconds(1_800_000_000));
        var tokens = new KioskQrTokens(clock);
        var parsed = KioskQrTokens.Parse(tokens.Create(KioskId, Secret).Token)!;

        clock.Now = clock.Now.AddSeconds(KioskQrTokens.WindowSeconds);
        Assert.Equal(KioskQrTokens.Result.Valid, tokens.Verify(parsed, Secret));

        clock.Now = clock.Now.AddSeconds(KioskQrTokens.WindowSeconds);
        Assert.Equal(KioskQrTokens.Result.Expired, tokens.Verify(parsed, Secret));
    }

    [Fact]
    public void Tampered_or_foreign_token_is_invalid()
    {
        var tokens = new KioskQrTokens(new FakeTime(DateTimeOffset.UtcNow));
        var parsed = KioskQrTokens.Parse(tokens.Create(KioskId, Secret).Token)!;

        var otherSecret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        Assert.Equal(KioskQrTokens.Result.Invalid, tokens.Verify(parsed, otherSecret));
        Assert.Equal(KioskQrTokens.Result.Invalid, tokens.Verify(parsed with { Window = parsed.Window + 1 }, Secret));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("not-a-guid.123.sig")]
    public void Garbage_does_not_parse(string? token) => Assert.Null(KioskQrTokens.Parse(token));
}
