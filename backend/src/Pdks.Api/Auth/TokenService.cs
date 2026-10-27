using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Pdks.Domain.Entities;

namespace Pdks.Api.Auth;

public class TokenService(IOptions<JwtOptions> options)
{
    private readonly JwtOptions _options = options.Value;

    public (string Token, DateTimeOffset ExpiresAt) CreateAccessToken(User user)
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(_options.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(PdksClaims.UserId, user.Id.ToString()),
            new(PdksClaims.Email, user.Email),
            new(PdksClaims.Name, user.FullName),
            new(PdksClaims.Role, user.Role.ToString()),
            new(PdksClaims.CompanyId, user.CompanyId.ToString())
        };
        if (user.MustChangePassword)
            claims.Add(new Claim(PdksClaims.MustChangePassword, "true"));
        if (user.BranchId is { } branchId)
            claims.Add(new Claim(PdksClaims.BranchId, branchId.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), expiresAt);
    }
}
