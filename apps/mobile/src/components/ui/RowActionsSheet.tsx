import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

export interface RowAction {
  /** Stable React key. Use a verb for action items (e.g., 'edit') or an entity id for grouped rows. */
  key: string;
  /** Emoji or single-char glyph rendered in the leading icon circle. */
  icon: string;
  label: string;
  onPress: () => void;
  /** Render the label in danger color. Optional. */
  destructive?: boolean;
  /** Override the icon background. Optional — defaults to a subtle raised tint. */
  iconBackground?: string;
  /** Override the icon glyph color. Optional. */
  iconColor?: string;
}

export interface RowActionGroup {
  /** Section heading shown above the rows. */
  label: string;
  items: RowAction[];
}

export interface RowActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Title rendered at the top of the sheet (typically the entity name). */
  title: string;
  /** Top-level action rows (Edit, Follow-up, Move, Delete, …). */
  actions: RowAction[];
  /** Optional grouped sections rendered below the actions (e.g., "Linked", "Contact"). */
  groups?: RowActionGroup[];
}

/**
 * A reusable bottom-sheet menu used by:
 * - LogRow action menu (Phase 2)
 * - Account/contact options dialogs (Phase 3)
 *
 * Renders: overlay → sheet → title → action rows → optional groups → Cancel.
 * Tapping the overlay or "Cancel" calls onClose. The actions themselves are
 * responsible for closing the sheet via their own onPress.
 */
export function RowActionsSheet({ visible, onClose, title, actions, groups }: RowActionsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>

          <View style={styles.body}>
            {actions.map((a) => (
              <Row key={a.key} action={a} />
            ))}

            {groups?.map((g) => (
              <React.Fragment key={g.label}>
                <Text style={styles.section}>{g.label}</Text>
                {g.items.map((item) => (
                  <Row key={item.key} action={item} />
                ))}
              </React.Fragment>
            ))}
          </View>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ action }: { action: RowAction }) {
  const iconBg = action.iconBackground ?? colors.bg.raised;
  return (
    <Pressable style={styles.row} onPress={action.onPress}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Text style={action.iconColor ? { color: action.iconColor } : undefined}>{action.icon}</Text>
      </View>
      <Text
        style={[
          styles.rowText,
          action.destructive && { color: colors.text.danger },
        ]}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    paddingHorizontal: spacing[1],
  },
  body: {
    gap: spacing[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: typography.size.base,
    color: colors.text.primary,
  },
  section: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing[1],
    marginTop: spacing[1],
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    marginTop: spacing[1],
  },
  cancelText: {
    fontSize: typography.size.base,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
});
