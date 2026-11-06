package io.github.bhaashik.bhaasa;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.net.Uri;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (bridge == null) return; // Capacitor can show an unsupported-WebView error.
        // Keep Apps Script's receipt frames inside the WebView. Top-level remote
        // links still use Capacitor's external-browser behavior; no allowNavigation
        // wildcard or remote document is granted the app's local origin.
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                String host = url.getHost();
                boolean googleReceipt = host != null && (host.equals("script.google.com") ||
                    host.equals("script.googleusercontent.com") || host.matches("[a-z0-9-]+-script\\.googleusercontent\\.com"));
                if (!request.isForMainFrame() && "https".equals(url.getScheme()) && googleReceipt) return false;
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
