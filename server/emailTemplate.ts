export interface InvitationEmailTemplateInput {
  recipientName: string;
  recipientEmail: string;
  organizationName: string;
  invitationCode: string;
  roleLabel: string;
  departmentName?: string | null;
  positionTitle?: string | null;
  expiresAtIso: string;
  registrationUrl: string;
}

export interface RenderedInvitationEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpirationDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }) + ' (UTC)';
}

export function buildInvitationEmail(input: InvitationEmailTemplateInput): RenderedInvitationEmail {
  const recipientName = input.recipientName.trim() || input.recipientEmail.split('@')[0] || 'Team Member';
  const orgName = input.organizationName.trim() || 'MARS';
  const roleLabel = input.roleLabel.trim() || 'Team Member';
  const expiresLabel = formatExpirationDate(input.expiresAtIso);

  const subject = "You're Invited to Join MARS";

  const orgAssignmentLines: string[] = [];
  if (input.departmentName) orgAssignmentLines.push(`Department: ${input.departmentName}`);
  if (input.positionTitle) orgAssignmentLines.push(`Position: ${input.positionTitle}`);

  const text = [
    `Hello ${recipientName},`,
    '',
    `You have been invited to join the MARS workspace for ${orgName}.`,
    '',
    'Your Invitation Code:',
    input.invitationCode,
    '',
    `Assigned Role: ${roleLabel}`,
    ...orgAssignmentLines,
    `Expiration Date: ${expiresLabel}`,
    '',
    'Complete your registration using the link below:',
    input.registrationUrl,
    '',
    'Or visit the MARS sign-in page, click "Join your team", and enter the invitation code above with this email address.',
    '',
    'If you did not expect this invitation, you can safely ignore this email.',
    '',
    'MARS Team',
    'Project Collaboration & Task Management'
  ].join('\n');

  const assignmentHtml = [
    `<div style="margin-bottom:6px;"><span style="color:#64748b;">Assigned Role:</span> <strong style="color:#0f172a;">${escapeHtml(roleLabel)}</strong></div>`,
    input.departmentName
      ? `<div style="margin-bottom:6px;"><span style="color:#64748b;">Department:</span> <strong style="color:#0f172a;">${escapeHtml(input.departmentName)}</strong></div>`
      : '',
    input.positionTitle
      ? `<div style="margin-bottom:6px;"><span style="color:#64748b;">Position:</span> <strong style="color:#0f172a;">${escapeHtml(input.positionTitle)}</strong></div>`
      : '',
    `<div><span style="color:#64748b;">Expires On:</span> <strong style="color:#0f172a;">${escapeHtml(expiresLabel)}</strong></div>`
  ]
    .filter(Boolean)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr>
            <td style="background-color:#0f172a;padding:22px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:7px;background-color:#ffffff;color:#0f172a;font-weight:800;font-size:15px;vertical-align:middle;">M</span>
                    <span style="color:#ffffff;font-weight:700;font-size:16px;letter-spacing:-0.01em;margin-left:10px;vertical-align:middle;">MARS</span>
                  </td>
                  <td align="right" style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">
                    Workspace Invitation
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#0f172a;">
                Hello <strong>${escapeHtml(recipientName)}</strong>,
              </p>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#334155;">
                You have been invited to join the MARS workspace for <strong>${escapeHtml(orgName)}</strong>.
              </p>

              <div style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:18px;text-align:center;margin-bottom:20px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">
                  Your Invitation Code
                </div>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:21px;font-weight:700;letter-spacing:0.08em;color:#0f172a;word-break:break-all;">
                  ${escapeHtml(input.invitationCode)}
                </div>
              </div>

              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.5;margin-bottom:24px;">
                ${assignmentHtml}
              </div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(input.registrationUrl)}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 24px;border-radius:9px;">
                      Accept Invitation &amp; Register
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:#64748b;">
                Or copy this registration link into your browser:
              </p>
              <p style="margin:0 0 22px;font-size:11px;line-height:1.5;color:#2563eb;word-break:break-all;">
                <a href="${escapeHtml(input.registrationUrl)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(input.registrationUrl)}</a>
              </p>

              <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b;">
                If you did not expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 28px;font-size:12px;color:#475569;">
              <strong style="color:#0f172a;">MARS Team</strong><br />
              <span style="color:#64748b;">Project Collaboration &amp; Task Management</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
