"use client"

import { SettingsSection } from "@/components/settings/settings-section"
import { FormSwitch, FormSelect } from "@/components/settings/form-field"
import { Button } from "@/components/ui/button"
import { Shield, Trash2 } from "lucide-react"
import { type UseFormReturn } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, InfoIcon } from "lucide-react"
import { type IntegrationsConfigFormData } from "@/schemas/settings/integrations.schema"

interface AIPrivacyTabProps {
  form: UseFormReturn<IntegrationsConfigFormData>
}

const autoDeletOptions = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "365 days", value: "365" },
]

export function AIPrivacyTab({ form }: AIPrivacyTabProps) {
  const saveHistory = form.watch("save_history")
  const autoDeleteDays = form.watch("auto_delete_days")

  const handleClearHistory = () => {
    if (
      confirm(
        "Are you sure you want to clear all conversation history? This action cannot be undone."
      )
    ) {
      // 实际清除逻辑
      alert("Conversation history has been cleared.")
    }
  }

  return (
    <SettingsSection
      title="Privacy settings"
      description="Manage AI conversation privacy and retention policy"
      icon={<Shield className="h-5 w-5" />}
    >
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Your privacy and data security are our top priority. The settings
          below help you control how AI conversation data is stored and used.
        </AlertDescription>
      </Alert>

      <FormSwitch
        form={form}
        name="save_history"
        label="Save conversation history"
        description="When enabled, your AI conversations will be saved for later review and analysis."
      />

      {saveHistory && (
        <>
          <FormSwitch
            form={form}
            name="allow_training"
            label="Allow for model training"
            description="Allow your conversation data to be used to improve AI models (fully anonymized)."
          />

          <div className="space-y-2">
              <FormSelect
                form={form}
                name="auto_delete_days"
                label="Auto delete conversations"
                description="Configure automatic deletion time for conversation history"
              options={autoDeletOptions.map(opt => ({
                label: opt.label,
                value: opt.value
              }))}
              placeholder="Choose retention period"
            />
          </div>

          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-2">
              Current settings preview:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                • Save history:
                <span className="text-foreground font-medium">
                  Enabled
                </span>
              </li>
              <li>
                • Use for training:
                <span className="text-foreground font-medium">
                  {form.watch("allow_training") ? "Allowed" : "Not allowed"}
                </span>
              </li>
              <li>
                • Auto delete:
                <span className="text-foreground font-medium">
                  after {autoDeleteDays} days
                </span>
              </li>
            </ul>
          </div>
        </>
      )}

      {!saveHistory && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            If conversation history is disabled, your conversations will not be
            saved. You will not be able to view past conversations or perform
            conversation analysis.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Clear all conversation history</h4>
        <p className="text-sm text-muted-foreground">
          Permanently delete all saved AI conversations. This action cannot be
          undone.
        </p>
        <Button
          variant="destructive"
          onClick={handleClearHistory}
          className="w-full md:w-auto"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear all history
        </Button>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">Data privacy notes:</p>
        <div className="text-sm text-muted-foreground space-y-2">
          <div>
            <p className="font-medium text-foreground">Data storage:</p>
            <ul className="list-disc list-inside ml-2">
              <li>
                All conversation data is stored encrypted on local servers.
              </li>
              <li>Your conversation content is not shared with third parties.</li>
              <li>Administrators cannot view your private conversations.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Model training:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Used only when you explicitly grant permission.</li>
              <li>All data is fully anonymized.</li>
              <li>You can revoke consent at any time.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground">Data retention:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Old conversations are deleted automatically as configured.</li>
              <li>Deleted data cannot be recovered.</li>
              <li>You can manually clear all history at any time.</li>
            </ul>
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
