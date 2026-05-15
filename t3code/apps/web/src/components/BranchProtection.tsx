import React, { useState, useEffect, useCallback } from "react";

interface ProtectionRule {
  requirePullRequest: boolean;
  requiredReviews: number;
  requireStatusChecks: boolean;
  statusCheckContexts: string[];
  requireSignedCommits: boolean;
  allowForcePush: boolean;
  restrictPushers: boolean;
}

interface BranchProtectionProps {
  currentBranch: string;
  gitProvider: "github" | "gitlab" | "bitbucket";
  onForcePush: (branch: string) => Promise<void>;
  onPush: (branch: string) => Promise<void>;
}

const BranchProtectionIndicator: React.FC<{
  branch: string;
  protection: ProtectionRule | null;
  loading: boolean;
}> = ({ branch, protection, loading }) => {
  if (loading) return <span className="protection-loading">⏳</span>;
  if (!protection) return null;

  return (
    <div className="branch-protection-indicator" title={getProtectionTooltip(protection)}>
      <span className="protection-lock" role="img" aria-label="Protected branch">🔒</span>
    </div>
  );
};

const ForcePushButton: React.FC<{
  protected_: boolean;
  onForcePush: () => void;
}> = ({ protected: protected_, onForcePush }) => {
  const [confirming, setConfirming] = useState(false);

  if (protected_) {
    return (
      <button className="force-push-btn disabled" disabled title="Force push is disabled for protected branches">
        Force Push
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="force-push-confirm">
        <span>Are you sure?</span>
        <button className="confirm-btn danger" onClick={onForcePush}>
          Confirm
        </button>
        <button className="cancel-btn" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button className="force-push-btn" onClick={() => setConfirming(true)}>
      Force Push
    </button>
  );
};

const ProtectionWarningDialog: React.FC<{
  open: boolean;
  branch: string;
  protection: ProtectionRule;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, branch, protection, onConfirm, onCancel }) => {
  if (!open) return null;

  return (
    <div className="protection-dialog-overlay">
      <div className="protection-dialog" role="dialog" aria-label="Protected branch warning">
        <h3>⚠️ Protected Branch: {branch}</h3>
        <p>
          This branch has protection rules that may require a pull request for changes.
        </p>
        <ul>
          {protection.requirePullRequest && <li>Requires pull request</li>}
          {protection.requiredReviews > 0 && (
            <li>Requires {protection.requiredReviews} review(s)</li>
          )}
          {protection.requireStatusChecks && (
            <li>Requires status checks: {protection.statusCheckContexts.join(", ")}</li>
          )}
          {protection.requireSignedCommits && <li>Requires signed commits</li>}
        </ul>
        <div className="dialog-actions">
          <button className="dialog-btn danger" onClick={onConfirm}>
            Push Anyway
          </button>
          <button className="dialog-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export const BranchProtectionWrapper: React.FC<BranchProtectionProps> = ({
  currentBranch,
  gitProvider,
  onForcePush,
  onPush,
}) => {
  const [protection, setProtection] = useState<ProtectionRule | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const fetchProtection = useCallback(async () => {
    setLoading(true);
    try {
      // This would call the actual git provider API
      const rules = await fetchProtectionRules(gitProvider, currentBranch);
      setProtection(rules);
    } catch {
      setProtection(null);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, gitProvider]);

  useEffect(() => {
    fetchProtection();
  }, [fetchProtection]);

  const isProtected = protection !== null;

  const handlePush = async () => {
    if (isProtected && protection?.requirePullRequest) {
      setShowWarning(true);
    } else {
      await onPush(currentBranch);
    }
  };

  const handleForcePush = async () => {
    await onForcePush(currentBranch);
  };

  return (
    <div className="branch-protection-wrapper">
      <BranchProtectionIndicator branch={currentBranch} protection={protection} loading={loading} />
      <button className="push-btn" onClick={handlePush}>
        Push
      </button>
      <ForcePushButton protected_={isProtected} onForcePush={handleForcePush} />
      <ProtectionWarningDialog
        open={showWarning}
        branch={currentBranch}
        protection={protection!}
        onConfirm={() => {
          setShowWarning(false);
          onPush(currentBranch);
        }}
        onCancel={() => setShowWarning(false)}
      />
    </div>
  );
};

async function fetchProtectionRules(
  provider: string,
  branch: string
): Promise<ProtectionRule | null> {
  // Placeholder - would call actual provider API
  return null;
}

function getProtectionTooltip(protection: ProtectionRule): string {
  const rules: string[] = [];
  if (protection.requirePullRequest) rules.push("Pull request required");
  if (protection.requiredReviews > 0) rules.push(`${protection.requiredReviews} review(s) required`);
  if (protection.requireStatusChecks) rules.push("Status checks required");
  if (protection.requireSignedCommits) rules.push("Signed commits required");
  return `Protected: ${rules.join(", ")}`;
}

export default BranchProtectionWrapper;
