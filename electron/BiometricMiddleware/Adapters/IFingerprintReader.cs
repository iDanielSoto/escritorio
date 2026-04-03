using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace BiometricMiddleware.Adapters
{
    public interface IFingerprintReader
    {
        string ReaderBrand { get; }
        string DeviceModel { get; }
        string SerialNumber { get; }
        bool IsConnected { get; }
        bool IsCapturing { get; }

        event Func<string, string, Task> OnStatusChanged;
        event Func<int, int, Task> OnEnrollProgress;
        event Func<CaptureResult, Task> OnCaptureComplete;
        event Func<string, Task> OnFingerDetected;
        event Func<Task> OnFingerRemoved;

        Task<bool> Initialize();
        void Dispose();
        Task StartEnrollment(string userId);
        void CancelEnrollment();
        Task StartVerification(string userId, byte[] template);
        Task StartIdentification(Dictionary<string, byte[]> templates);
        void PreloadTemplates(Dictionary<string, byte[]> templates);
        void StopCapture();
        Task<int> GetConnectedReadersCount();
        Task<List<ReaderInfo>> GetReadersInfo();
    }

    public class ReaderInfo
    {
        public string Brand { get; set; }
        public string Model { get; set; }
        public string SerialNumber { get; set; }
        public bool IsAvailable { get; set; }
    }

    public class CaptureResult
    {
        public CaptureResultType ResultType { get; set; }
        public string UserId { get; set; }
        public int? MatchScore { get; set; }
        public byte[] Template { get; set; }
        public string Message { get; set; }

        public string TemplateBase64 => Template != null ? Convert.ToBase64String(Template) : null;
    }

    public enum CaptureResultType
    {
        EnrollmentSuccess,
        EnrollmentFailed,
        VerificationSuccess,
        VerificationFailed,
        IdentificationSuccess,
        IdentificationFailed,
        Error
    }

    public enum OperationType
    {
        None,
        Enrollment,
        Verification,
        Identification
    }
}
