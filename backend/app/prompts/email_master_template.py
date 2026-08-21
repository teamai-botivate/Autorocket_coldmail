"""
Master cold-outreach email template (System.txt section 14).
This is the seed/default EMAIL_TEMPLATES row created on first run.
"""

MASTER_SUBJECT = "A Complete Business Automation Team Beyond a Single MIS Hire"

MASTER_PLAIN_TEMPLATE = """Hi {{contact_name_or_team}},

I came across {{company_name}}'s opening for {{job_title}}{{location_suffix}} \
and wanted to reach out directly.

Hiring a single MIS/reporting resource often solves only part of the \
problem — the underlying work (daily reporting, dashboards, data \
consolidation across teams) usually needs more than one person can sustain \
manually over time.

At Botivate, we help companies like {{company_name}} replace repetitive \
manual reporting with automated dashboards and workflows through AutoRocket \
— effectively giving you a complete business automation team instead of \
depending on a single hire.

{{personalization_line}}

Would you be open to a short conversation on whether this could support \
what you're currently building the {{job_title}} role around?

Best regards,
{{sender_name}}
Botivate Services LLP
{{botivate_website}}
"""

MASTER_HTML_TEMPLATE = """<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6;">
<p>Hi {{contact_name_or_team}},</p>
<p>I came across {{company_name}}'s opening for <strong>{{job_title}}</strong>{{location_suffix}} and wanted to reach out directly.</p>
<p>Hiring a single MIS/reporting resource often solves only part of the problem — the underlying work (daily reporting, dashboards, data consolidation across teams) usually needs more than one person can sustain manually over time.</p>
<p>At Botivate, we help companies like {{company_name}} replace repetitive manual reporting with automated dashboards and workflows through <strong>AutoRocket</strong> — effectively giving you a complete business automation team instead of depending on a single hire.</p>
<p>{{personalization_line}}</p>
<p>Would you be open to a short conversation on whether this could support what you're currently building the {{job_title}} role around?</p>
<p>Best regards,<br/>{{sender_name}}<br/>Botivate Services LLP<br/><a href="{{botivate_website}}">{{botivate_website}}</a></p>
</div>"""

DEFAULT_FOLLOW_UP_1_SUBJECT = "Re: A Complete Business Automation Team Beyond a Single MIS Hire"
DEFAULT_FOLLOW_UP_1_BODY = """Hi {{contact_name_or_team}},

Just following up on my earlier note regarding {{company_name}}'s {{job_title}} requirement.

If your team is currently evaluating options for MIS reporting, dashboards, \
or business process automation, we'd be happy to discuss how Botivate could support it.

Please let me know if this would be relevant.

Best regards,
{{sender_name}}
Botivate Services LLP
"""

DEFAULT_FOLLOW_UP_FINAL_SUBJECT = "Closing the loop — Botivate x {{company_name}}"
DEFAULT_FOLLOW_UP_FINAL_BODY = """Hi {{contact_name_or_team}},

I don't want to keep following up if the timing isn't right — I'll leave \
this here for now.

If a need for MIS/reporting automation comes up in the future, feel free to \
reach out anytime.

Best regards,
{{sender_name}}
Botivate Services LLP
"""
