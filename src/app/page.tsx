"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type UserProfile = {
  employeeNumber: string;
  name: string;
  surname: string;
  idNumber: string;
  cellphoneNumber: string;
  companyName: string;
  employer?: string;
  dateOfEngagement: string;
  bankName: string;
  accountNumber: string;
  idDocumentFile?: string;
};

type UploadResult = {
  payslip: string;
  bankStatement: string;
};

const currencyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

function calculateRepayment(amount: number) {
  return Math.round(amount * 1.2);
}

export default function Home() {
  const [screen, setScreen] = useState<
    "landing" | "login" | "change-password" | "flow"
  >("landing");
  const [step, setStep] = useState(2);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [login, setLogin] = useState({ employeeNumber: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [employeeVerified, setEmployeeVerified] = useState(false);
  const [checkingEmployee, setCheckingEmployee] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [employers, setEmployers] = useState<string[]>([]);
  const [employersError, setEmployersError] = useState("");

  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    accountNumber: "",
  });
  const [employmentDetails, setEmploymentDetails] = useState({
    companyName: "",
    employeeNumber: "",
    dateOfEngagement: "",
  });

  const [loanAmount, setLoanAmount] = useState(500);
  const repaymentAmount = useMemo(
    () => calculateRepayment(loanAmount),
    [loanAmount]
  );

  const [payslipFile, setPayslipFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const [signatureError, setSignatureError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [editModeByStep, setEditModeByStep] = useState<Record<number, boolean>>(
    {}
  );
  const [history, setHistory] = useState<
    { step: number; timestamp: string; data: Record<string, unknown> }[]
  >([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasSignatureRef = useRef(false);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const loadMe = async () => {
      const response = await fetch("/api/me");
      if (!response.ok) return;
      const data = await response.json();
      setUser(data.user);
      setBankDetails({
        bankName: data.user.bankName,
        accountNumber: data.user.accountNumber,
      });
      setEmploymentDetails({
        companyName: data.user.companyName || data.user.employer || "",
        employeeNumber: data.user.employeeNumber,
        dateOfEngagement: data.user.dateOfEngagement,
      });
      setScreen("flow");
      setStep(2);
    };
    void loadMe();
  }, []);

  useEffect(() => {
    const loadEmployers = async () => {
      const response = await fetch("/api/employers");
      if (!response.ok) {
        setEmployersError("Unable to load employers.");
        return;
      }
      const data = await response.json();
      setEmployers(data.employers ?? []);
    };
    void loadEmployers();
  }, []);

  useEffect(() => {
    if (!signatureModalOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineCap = "round";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 4;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [signatureModalOpen]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError("");
    if (!employeeVerified) {
      setCheckingEmployee(true);
      const response = await fetch("/api/employee-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNumber: login.employeeNumber }),
      });
      setCheckingEmployee(false);
      if (!response.ok) {
        const error = await response.json();
        setLoginError(
          error?.error ??
            "Employee number not found. Please contact Pronto Loans for assistance."
        );
        return;
      }
      setEmployeeVerified(true);
      return;
    }

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(login),
    });

    if (!response.ok) {
      let errorMessage = "Login failed.";
      try {
        const error = await response.json();
        errorMessage = error?.error ?? errorMessage;
      } catch {
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text;
      }
      setLoginError(errorMessage);
      return;
    }

    const data = await response.json();
    if (data.mustChangePassword) {
      setScreen("change-password");
      return;
    }

    setUser(data.user);
    setBankDetails({
      bankName: data.user.bankName,
      accountNumber: data.user.accountNumber,
    });
    setEmploymentDetails({
      companyName: data.user.companyName || data.user.employer || "",
      employeeNumber: data.user.employeeNumber,
      dateOfEngagement: data.user.dateOfEngagement,
    });
    setScreen("flow");
    setStep(2);
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setNewPasswordError("");

    const response = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!response.ok) {
      const error = await response.json();
      setNewPasswordError(
        error?.error ??
          "Password must be 6-20 characters and include at least 1 uppercase letter and 1 number."
      );
      return;
    }

    const meResponse = await fetch("/api/me");
    if (!meResponse.ok) {
      setNewPasswordError("Unable to load profile. Please login again.");
      setScreen("login");
      setEmployeeVerified(false);
      setLogin({ employeeNumber: "", password: "" });
      return;
    }
    const data = await meResponse.json();
    setUser(data.user);
    setBankDetails({
      bankName: data.user.bankName,
      accountNumber: data.user.accountNumber,
    });
    setEmploymentDetails({
      companyName: data.user.companyName || data.user.employer || "",
      employeeNumber: data.user.employeeNumber,
      dateOfEngagement: data.user.dateOfEngagement,
    });
    setScreen("flow");
    setStep(2);
  };

  const getLastSaved = (stepNumber: number) =>
    history.find((entry) => entry.step === stepNumber);

  const saveStep = (stepNumber: number) => {
    const snapshot = {
      user,
      employmentDetails,
      bankDetails,
      loanAmount,
      uploadResult,
      signatureDataUrl,
    };
    setHistory((prev) => [
      { step: stepNumber, timestamp: new Date().toISOString(), data: snapshot },
      ...prev,
    ]);
    setEditModeByStep((prev) => ({ ...prev, [stepNumber]: false }));
  };

  const editStep = (stepNumber: number) => {
    setEditModeByStep((prev) => ({ ...prev, [stepNumber]: true }));
  };

  const renderStepActions = (stepNumber: number) => {
    const isEditing = !!editModeByStep[stepNumber];
    const lastSaved = getLastSaved(stepNumber);
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {lastSaved
            ? `Last saved: ${new Date(lastSaved.timestamp).toLocaleString()}`
            : "Not saved yet"}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            onClick={() => editStep(stepNumber)}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
            onClick={() => saveStep(stepNumber)}
          >
            Save
          </button>
        </div>
      </div>
    );
  };


  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSignatureDataUrl(dataUrl);
    setSignatureModalOpen(false);
  };


  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setScreen("landing");
    setStep(2);
    setEmployeeVerified(false);
    setLogin({ employeeNumber: "", password: "" });
  };

  const handleUpload = async () => {
    setFileError("");
    setUploading(true);

    if (!payslipFile || !bankFile) {
      setFileError("Both files are required.");
      setUploading(false);
      return;
    }

    if (payslipFile.size > 2 * 1024 * 1024 || bankFile.size > 2 * 1024 * 1024) {
      setFileError("File size exceeds 2MB limit.");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("payslip", payslipFile);
    formData.append("bankStatement", bankFile);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      setFileError(error?.error ?? "Upload failed.");
      setUploading(false);
      return;
    }

    const data = await response.json();
    setUploadResult(data);
    setUploading(false);
    setStep(8);
  };

  const resetUploads = () => {
    setPayslipFile(null);
    setBankFile(null);
    setFileError("");
    setUploadResult(null);
  };

  const getCanvasPoint = (
    event: React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      clearSignature();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    canvas.setPointerCapture(event.pointerId);

    drawingRef.current = true;
    hasSignatureRef.current = true;
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    const { x, y } = getCanvasPoint(event, canvas);
    ctx.moveTo(x, y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasPoint(event, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (event && canvasRef.current) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignatureRef.current = false;
    setSignatureDataUrl(null);
  };

  const submitApplication = async () => {
    setSignatureError("");
    setSubmitting(true);

    if (!hasSignatureRef.current) {
      setSignatureError("Please provide a signature.");
      setSubmitting(false);
      return;
    }

    const signatureData = signatureDataUrl;

    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        employmentDetails,
        bankDetails,
        loanAmount,
        repaymentAmount,
        uploadResult,
        signatureData,
      }),
    });

    if (!response.ok) {
      let errorMessage = "Submission failed.";
      try {
        const error = await response.json();
        errorMessage = error?.error ?? errorMessage;
      } catch {
        const text = await response.text().catch(() => "");
        if (text) errorMessage = text;
      }
      setSignatureError(errorMessage);
      setSubmitting(false);
      return;
    }

    setSubmitResult("Application submitted successfully.");
    setSubmitting(false);
  };

  const handleDone = async () => {
    await handleLogout();
    setLogin({ employeeNumber: "", password: "" });
    setLoanAmount(500);
    setUploadResult(null);
    setPayslipFile(null);
    setBankFile(null);
    setFileError("");
    setSubmitResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Pronto Loans
            </p>
            <h1 className="text-3xl font-semibold">Loan Application</h1>
          </div>
          {user && (
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Logout
            </button>
          )}
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          {screen === "flow" ? (
            <p className="text-sm font-medium text-slate-500">
              Step {step} of 9
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-500">
              Welcome to Pronto Loans
            </p>
          )}

          {screen === "landing" && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-slate-600">
                Continue to login.
              </p>
              <button
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
                onClick={() => setScreen("login")}
              >
                Continue to login
              </button>
            </div>
          )}

          {screen === "login" && (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Employee Number
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                  value={login.employeeNumber}
                  onChange={(event) =>
                    setLogin((prev) => ({
                      ...prev,
                      employeeNumber: event.target.value,
                    }))
                  }
                  required
                  disabled={employeeVerified}
                />
              </div>
              {employeeVerified && (
                <div>
                  <label className="text-sm font-medium text-slate-600">
                    Password
                  </label>
                  <div className="relative mt-2">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12"
                      value={login.password}
                      onChange={(event) =>
                        setLogin((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
                      aria-label={
                        showLoginPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                    >
                      {showLoginPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M3.53 2.47a.75.75 0 10-1.06 1.06l2.11 2.11C2.66 7.05 1.35 8.77.75 10.11a1.75 1.75 0 000 1.78C2.3 14.78 6.22 18 12 18c1.7 0 3.23-.27 4.6-.75l4.17 4.17a.75.75 0 101.06-1.06l-18.3-18.3zm6.6 6.6l6.8 6.8a3.75 3.75 0 01-6.8-6.8z" />
                          <path d="M12 6c5.78 0 9.7 3.22 11.25 6.11.23.44.23 1 0 1.44-.54 1.01-1.54 2.27-3.07 3.46l-1.5-1.5a9.3 9.3 0 002.27-2.57C19.65 9.57 16.43 7 12 7c-1.04 0-2.02.12-2.94.35L7.5 5.8C8.88 5.28 10.38 5 12 5c.41 0 .82.02 1.21.05A.75.75 0 0112 6z" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M12 5c-5.78 0-9.7 3.22-11.25 6.11-.23.44-.23 1 0 1.78C2.3 16.78 6.22 20 12 20s9.7-3.22 11.25-6.11c.23-.44.23-1 0-1.78C21.7 8.22 17.78 5 12 5zm0 11a4 4 0 110-8 4 4 0 010 8z" />
                          <path d="M12 10a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
              {loginError && (
                <p className="text-sm text-red-600">{loginError}</p>
              )}
              <button
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white"
                type="submit"
                disabled={checkingEmployee}
              >
                {employeeVerified
                  ? "Sign in"
                  : checkingEmployee
                  ? "Checking..."
                  : "Next"}
              </button>
              {employeeVerified && (
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => {
                    setEmployeeVerified(false);
                    setLogin((prev) => ({ ...prev, password: "" }));
                  }}
                >
                  Change employee number
                </button>
              )}
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
                onClick={() => setScreen("landing")}
              >
                Back
              </button>
            </form>
          )}

          {screen === "change-password" && (
            <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
              <p className="text-sm text-slate-600">
                First-time login detected. Please set a new password.
              </p>
              <div>
                <label className="text-sm font-medium text-slate-600">
                  New Password
                </label>
                <input
                  type="password"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                6-20 characters, at least 1 uppercase letter and 1 number.
              </p>
              {newPasswordError && (
                <p className="text-sm text-red-600">{newPasswordError}</p>
              )}
              <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white">
                Save new password
              </button>
            </form>
          )}


          {screen === "flow" && step === 2 && user && (
            <div className="mt-6 space-y-4">
              {renderStepActions(2)}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Client details</p>
                <p className="text-lg font-semibold">
                  {user.name} {user.surname}
                </p>
                <p className="text-sm text-slate-600">ID: {user.idNumber}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={handleLogout}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                  onClick={() => setStep(3)}
                >
                  Confirm client details
                </button>
              </div>
            </div>
          )}

          {screen === "flow" && step === 3 && user && (
            <div className="mt-6 space-y-4">
              {renderStepActions(3)}
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Employer
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                  value={employmentDetails.companyName}
                  onChange={(event) =>
                    setEmploymentDetails((prev) => ({
                      ...prev,
                      companyName: event.target.value,
                    }))
                  }
                >
                  <option value="">Select employer</option>
                  {employers.map((employer) => (
                    <option key={employer} value={employer}>
                      {employer}
                    </option>
                  ))}
                </select>
                {employersError && (
                  <p className="mt-2 text-sm text-red-600">{employersError}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Employee number
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                  value={employmentDetails.employeeNumber}
                  onChange={(event) =>
                    setEmploymentDetails((prev) => ({
                      ...prev,
                      employeeNumber: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Date of engagement
                </label>
                <input
                  type="date"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                  value={employmentDetails.dateOfEngagement}
                  onChange={(event) =>
                    setEmploymentDetails((prev) => ({
                      ...prev,
                      dateOfEngagement: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(2)}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                  onClick={() => setStep(4)}
                >
                  Confirm employment
                </button>
              </div>
            </div>
          )}

          {screen === "flow" && step === 4 && (
            <div className="mt-6 space-y-4">
              {renderStepActions(4)}
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Bank name
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                  value={bankDetails.bankName}
                  onChange={(event) =>
                    setBankDetails((prev) => ({
                      ...prev,
                      bankName: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Account number
                </label>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                  value={bankDetails.accountNumber}
                  onChange={(event) =>
                    setBankDetails((prev) => ({
                      ...prev,
                      accountNumber: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(3)}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                  onClick={() => setStep(5)}
                >
                  Confirm banking details
                </button>
              </div>
            </div>
          )}

          {screen === "flow" && step === 5 && (
            <div className="mt-6 space-y-6">
              {renderStepActions(5)}
              <div>
                <p className="text-sm font-medium text-slate-600">
                  Select loan amount
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {currencyFormatter.format(loanAmount)}
                </p>
              </div>
              <input
                type="range"
                min={500}
                max={2500}
                step={100}
                value={loanAmount}
                onChange={(event) => setLoanAmount(Number(event.target.value))}
                className="w-full"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(4)}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                  onClick={() => setStep(6)}
                >
                  Confirm loan amount
                </button>
              </div>
            </div>
          )}

          {screen === "flow" && step === 6 && (
            <div className="mt-6 space-y-4">
              {renderStepActions(6)}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Requested amount</p>
                <p className="text-2xl font-semibold">
                  {currencyFormatter.format(loanAmount)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Estimated repayment (placeholder):{" "}
                  {currencyFormatter.format(repaymentAmount)}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(5)}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(5)}
                >
                  Decline
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                  onClick={() => setStep(7)}
                >
                  Accept
                </button>
              </div>
            </div>
          )}

          {screen === "flow" && step === 7 && (
            <div className="mt-6 space-y-4">
              {renderStepActions(7)}
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Upload payslip (PDF or photo, max 2MB)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3"
                  onChange={(event) =>
                    setPayslipFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">
                  Upload bank statement (PDF or photo, max 2MB)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3"
                  onChange={(event) =>
                    setBankFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              {fileError && <p className="text-sm text-red-600">{fileError}</p>}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(6)}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={resetUploads}
                >
                  Retry
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Confirm uploads"}
                </button>
              </div>
            </div>
          )}

          {screen === "flow" && step === 8 && user && uploadResult && (
            <div className="mt-6 space-y-4">
              {renderStepActions(8)}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Summary</p>
                <p className="text-lg font-semibold">
                  {user.name} {user.surname} (ID: {user.idNumber})
                </p>
                <p className="text-sm text-slate-600">
                  Employment: {employmentDetails.companyName} •{" "}
                  {employmentDetails.employeeNumber} •{" "}
                  {employmentDetails.dateOfEngagement}
                </p>
                <p className="text-sm text-slate-600">
                  Bank: {bankDetails.bankName} • {bankDetails.accountNumber}
                </p>
                <p className="text-sm text-slate-600">
                  Loan: {currencyFormatter.format(loanAmount)} • Estimated
                  repayment {currencyFormatter.format(repaymentAmount)}
                </p>
                <p className="text-sm text-slate-600">
                  Payslip file: {uploadResult.payslip}
                </p>
                <p className="text-sm text-slate-600">
                  Bank statement file: {uploadResult.bankStatement}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(7)}
                >
                  Back
                </button>
                <button
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                  onClick={() => setStep(5)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                  onClick={() => setStep(9)}
                >
                  Confirm summary
                </button>
              </div>
            </div>
          )}

          {screen === "flow" && step === 9 && (
            <div className="mt-6 space-y-4">
              {renderStepActions(9)}
              <p className="text-sm text-slate-600">
                Please sign below to confirm your application.
              </p>
              <button
                type="button"
                onClick={() => setSignatureModalOpen(true)}
                className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-left"
              >
                {signatureDataUrl ? (
                  <img
                    src={signatureDataUrl}
                    alt="Signature preview"
                    className="h-28 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center text-sm text-slate-500">
                    Tap to sign
                  </div>
                )}
              </button>
              {signatureError && (
                <p className="text-sm text-red-600">{signatureError}</p>
              )}
              {submitResult && (
                <p className="text-sm text-emerald-600">{submitResult}</p>
              )}
              {!submitResult && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                    onClick={() => setStep(8)}
                    disabled={submitting}
                  >
                    Back
                  </button>
                  <button
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                    onClick={clearSignature}
                    disabled={submitting}
                  >
                    Clear signature
                  </button>
                  <button
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                    onClick={submitApplication}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit application"}
                  </button>
                </div>
              )}
              {submitResult && (
                <button
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-white"
                  onClick={handleDone}
                >
                  Done
                </button>
              )}
            </div>
          )}
        </div>
      </main>
      {signatureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-4 shadow-lg sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Sign here</h2>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-sm"
                onClick={() => setSignatureModalOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="h-[50vh] w-full">
              <canvas
                ref={canvasRef}
                width={900}
                height={400}
                className="h-full w-full rounded-2xl border border-slate-200 bg-white"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={endDraw}
                onPointerCancel={endDraw}
                onPointerLeave={endDraw}
                style={{ touchAction: "none" }}
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3"
                onClick={clearSignature}
              >
                Clear
              </button>
              <button
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-white"
                onClick={confirmSignature}
              >
                Confirm signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
