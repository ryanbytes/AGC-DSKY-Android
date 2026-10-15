package org.apollo.agcdsky;

/**
 * Independent date-header clock widget. The original provider is retained for
 * existing home-screen installations and always displays classic DSKY labels.
 * Shared timing, rendering, and update logic lives in ElWidgetProvider.
 */
public final class DateElWidgetProvider extends ElWidgetProvider {
    @Override protected boolean isDateWidget(){return true;}
}
