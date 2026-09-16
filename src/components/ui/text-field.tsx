import { useState, type ReactNode, type Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import { fonts, radius, spacing, typography } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: IconName;
  /** Text shown before the input, e.g. a currency symbol. */
  prefix?: string;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputRef?: Ref<TextInput>;
  /** `xl` is a large, borderless input for hero amounts (the parent provides the frame). */
  size?: 'md' | 'xl';
}

export function TextField({
  label,
  error,
  hint,
  icon,
  prefix,
  right,
  containerStyle,
  inputRef,
  size = 'md',
  multiline,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  const isXL = size === 'xl';

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" color="textSecondary" nativeID={`${label}-label`}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: colors.surface,
            minHeight: 50,
            alignItems: multiline ? 'flex-start' : 'center',
          },
          isXL && styles.fieldXL,
        ]}>
        {icon ? (
          <Icon
            name={icon}
            size={18}
            color={focused ? 'primary' : 'textMuted'}
            style={multiline ? styles.multilineIcon : undefined}
          />
        ) : null}
        {prefix ? (
          <Text
            variant={isXL ? 'display' : 'body'}
            weight={isXL ? 'bold' : 'medium'}
            color="textMuted">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          aria-labelledby={label ? `${label}-label` : undefined}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            isXL ? typography.display : typography.body,
            {
              color: colors.text,
              fontFamily: isXL ? fonts.bold : fonts.regular,
              minHeight: multiline ? 88 : undefined,
              paddingVertical: multiline ? spacing.md : 0,
            },
          ]}
          {...inputProps}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs + 2,
  },
  field: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    // Web inputs have an intrinsic width; allow them to shrink inside flex rows.
    minWidth: 0,
    alignSelf: 'stretch',
    // Removes the focus outline on web; the border already shows focus.
    outlineStyle: 'none',
  } as object,
  fieldXL: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    minHeight: 56,
    paddingHorizontal: 0,
  },
  multilineIcon: {
    marginTop: spacing.md + 1,
  },
});
