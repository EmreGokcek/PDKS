namespace Pdks.Domain.Enums;

public enum RequestType
{
    /// <summary>Unutulan / hatalı okutma için düzeltme.</summary>
    Correction = 1,
    Leave = 2
}

public enum RequestStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Cancelled = 4
}
