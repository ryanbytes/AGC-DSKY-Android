package org.apollo.agcdsky;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

public final class ElWidgetFrameService extends RemoteViewsService {
    static final String EXTRA_COUNT="org.apollo.agcdsky.EL_WIDGET_FRAME_COUNT";

    @Override public RemoteViewsFactory onGetViewFactory(Intent intent) {
        int count=intent==null?60:intent.getIntExtra(EXTRA_COUNT,60);
        return new FrameFactory(getApplicationContext(),Math.max(1,Math.min(60,count)));
    }

    private static final class FrameFactory implements RemoteViewsFactory {
        private final Context context;
        private final int count;
        FrameFactory(Context context,int count){this.context=context;this.count=count;}
        @Override public void onCreate(){}
        @Override public void onDataSetChanged(){}
        @Override public void onDestroy(){}
        @Override public int getCount(){return count;}
        @Override public RemoteViews getViewAt(int position){
            RemoteViews frame=new RemoteViews(context.getPackageName(),R.layout.el_second_frame);
            frame.setImageViewResource(R.id.el_second_image,ElWidgetProvider.frameDrawable(position));
            return frame;
        }
        @Override public RemoteViews getLoadingView(){return null;}
        @Override public int getViewTypeCount(){return 1;}
        @Override public long getItemId(int position){return position;}
        @Override public boolean hasStableIds(){return true;}
    }
}
