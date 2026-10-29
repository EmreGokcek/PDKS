using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Pdks.Api.Auth;
using Pdks.Api.Live;
using Pdks.Domain.Security;
using Pdks.Infrastructure;
using Pdks.Infrastructure.Auth;
using Pdks.Infrastructure.Live;
using Pdks.Infrastructure.Persistence;
using Pdks.Infrastructure.Persistence.Seed;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
builder.Services.Configure<JwtOptions>(jwtSection);
var jwt = jwtSection.Get<JwtOptions>() ?? new JwtOptions();

if (jwt.SigningKey.Length < 32)
    throw new InvalidOperationException("Jwt:SigningKey en az 32 karakter olmalı (ortam değişkeni: Jwt__SigningKey).");
// Geliştirme anahtarı depoda açıkça duruyor; üretimde kullanılırsa herkes geçerli token üretebilir.
if (!builder.Environment.IsDevelopment() && jwt.SigningKey.StartsWith("GELISTIRME", StringComparison.OrdinalIgnoreCase))
    throw new InvalidOperationException("Üretimde geliştirme JWT anahtarı kullanılamaz. Jwt__SigningKey ortam değişkenini ayarlayın.");

builder.Services.Configure<PrivacyOptions>(builder.Configuration.GetSection(PrivacyOptions.SectionName));
builder.Services.Configure<AppOptions>(builder.Configuration.GetSection(AppOptions.SectionName));
builder.Services.Configure<RegistrationOptions>(builder.Configuration.GetSection(RegistrationOptions.SectionName));
builder.Services.AddPdksRateLimits(builder.Configuration);

// Ters vekil sunucu (reverse proxy) arkasında gerçek istemci IP'si ve https bilgisi başlıklardan okunur.
var trustProxy = builder.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders");
if (trustProxy)
{
    builder.Services.Configure<ForwardedHeadersOptions>(o =>
    {
        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        // Barındırma ortamının vekil adresleri önceden bilinmediğinden tüm vekillere güvenilir;
        // bu ayar yalnızca uygulama doğrudan internete açık değilken açılmalı.
        o.KnownIPNetworks.Clear();
        o.KnownProxies.Clear();
    });
}

builder.Services.AddSingleton<TokenService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = PdksClaims.Name,
            RoleClaimType = PdksClaims.Role
        };
        // Tarayıcı WebSocket bağlantısında başlık gönderemez; canlı bağlantıda anahtar sorgu dizesinden okunur.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments(LiveHub.Path))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });
// Her yetki bir politika: [Authorize(Policy = Perm.X)] o yetkiye sahip rolleri kabul eder (Pdks.Domain/Security/Permissions.cs).
builder.Services.AddAuthorization(options =>
{
    foreach (var permission in Perm.All)
        options.AddPolicy(permission, p => p.RequireRole(RolePermissions.RolesWith(permission).Select(r => r.ToString())));
});

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails();

builder.Services.AddSignalR()
    .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSingleton<ILiveUpdates, HubLiveUpdates>();
if (builder.Configuration.GetValue("Alerts:Enabled", true))
    builder.Services.AddHostedService<AttendanceAlertWorker>();
builder.Services.AddOpenApi();

const string WebCors = "web";
builder.Services.AddCors(options => options.AddPolicy(WebCors, policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

// Açılışta migration (geliştirmede her zaman, üretimde Database:MigrateOnStartup ile) ve demo verisi.
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<PdksDbContext>();
    await db.Database.MigrateAsync();

    var seedOptions = scope.ServiceProvider.GetRequiredService<IOptions<SeedOptions>>().Value;
    await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync(seedOptions);
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // http://localhost:5080/scalar
}

if (trustProxy) app.UseForwardedHeaders();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors(WebCors);
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<PasswordChangeGate>();
app.UseAuthorization();
app.MapControllers();
app.MapHub<LiveHub>(LiveHub.Path);

app.Run();

/// <summary>Entegrasyon testlerinin (WebApplicationFactory) uygulamayı başlatabilmesi için.</summary>
public partial class Program;
