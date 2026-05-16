import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("概要", systemImage: "chart.bar.doc.horizontal")
                }

            AccountsView()
                .tabItem {
                    Label("アカウント", systemImage: "person.crop.circle.badge.checkmark")
                }

            SubscriptionsView()
                .tabItem {
                    Label("購読", systemImage: "tray.full")
                }

            ReportsView()
                .tabItem {
                    Label("分析", systemImage: "chart.pie")
                }

            SettingsView()
                .tabItem {
                    Label("設定", systemImage: "slider.horizontal.3")
                }
        }
        .tint(.teal)
    }
}

struct DashboardView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    MetricCard(title: "接続アカウント", value: "\(store.accounts.count)", systemImage: "mail.stack", color: .blue)
                    MetricCard(title: "購読メール", value: "\(store.activeSubscriptions.count)", systemImage: "tray.full", color: .teal)
                    MetricCard(title: "解除強く推奨", value: "\(store.highRecommendationCount)", systemImage: "exclamationmark.triangle", color: .red)
                    MetricCard(title: "推定削減/月", value: "\(store.savedMailCount)通", systemImage: "scissors", color: .green)
                }
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 12) {
                    Text("優先度が高い購読")
                        .font(.headline)
                        .padding(.horizontal)

                    ForEach(topRecommendations) { subscription in
                        SubscriptionCard(subscription: subscription, compact: true)
                            .padding(.horizontal)
                    }
                }
                .padding(.top, 12)
            }
            .navigationTitle("ダッシュボード")
            .toolbar {
                Button {
                    store.syncAll()
                } label: {
                    Label("同期", systemImage: "arrow.clockwise")
                }
            }
        }
    }

    private var topRecommendations: [Subscription] {
        store.activeSubscriptions
            .sorted { store.score(for: $0) > store.score(for: $1) }
            .prefix(3)
            .map { $0 }
    }
}

struct AccountsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(store.accounts) { account in
                        HStack(spacing: 12) {
                            Image(systemName: "envelope.circle.fill")
                                .font(.title2)
                                .foregroundStyle(account.provider.tint)

                            VStack(alignment: .leading, spacing: 4) {
                                Text(account.provider.rawValue)
                                    .font(.headline)
                                Text(account.email)
                                    .foregroundStyle(.secondary)
                                Text(account.syncedAt.map { "最終同期: \($0.formatted(date: .abbreviated, time: .shortened))" } ?? "未同期")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Text(account.isConnected ? "接続中" : "停止")
                                .font(.caption.weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(account.isConnected ? Color.green.opacity(0.14) : Color.gray.opacity(0.16))
                                .foregroundStyle(account.isConnected ? .green : .secondary)
                                .clipShape(Capsule())
                        }
                        .padding(.vertical, 6)
                    }
                }
            }
            .navigationTitle("アカウント")
            .toolbar {
                Button {
                    store.addDemoAccount()
                } label: {
                    Label("追加", systemImage: "plus")
                }
                .disabled(store.accounts.count >= 10)
            }
        }
    }
}

struct SubscriptionsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedProvider: MailProvider?
    @State private var selectedCategory: SubscriptionCategory?
    @State private var sort: SubscriptionSort = .score

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("並び替え", selection: $sort) {
                        ForEach(SubscriptionSort.allCases) { sort in
                            Text(sort.title).tag(sort)
                        }
                    }

                    Picker("サービス", selection: $selectedProvider) {
                        Text("すべて").tag(MailProvider?.none)
                        ForEach(MailProvider.allCases) { provider in
                            Text(provider.rawValue).tag(Optional(provider))
                        }
                    }

                    Picker("カテゴリ", selection: $selectedCategory) {
                        Text("すべて").tag(SubscriptionCategory?.none)
                        ForEach(SubscriptionCategory.allCases) { category in
                            Text(category.rawValue).tag(Optional(category))
                        }
                    }
                }

                Section {
                    ForEach(filteredSubscriptions) { subscription in
                        SubscriptionCard(subscription: subscription)
                            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                            .listRowSeparator(.hidden)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("購読一覧")
        }
    }

    private var filteredSubscriptions: [Subscription] {
        store.activeSubscriptions
            .filter { subscription in
                guard let selectedProvider else { return true }
                return store.account(for: subscription)?.provider == selectedProvider
            }
            .filter { subscription in
                guard let selectedCategory else { return true }
                return subscription.category == selectedCategory
            }
            .sorted { first, second in
                switch sort {
                case .score:
                    return store.score(for: first) > store.score(for: second)
                case .frequency:
                    return first.receiveCount30Days > second.receiveCount30Days
                case .sender:
                    return first.senderName.localizedCompare(second.senderName) == .orderedAscending
                }
            }
    }
}

struct SubscriptionCard: View {
    @EnvironmentObject private var store: AppStore
    var subscription: Subscription
    var compact = false

    var body: some View {
        let score = store.score(for: subscription)
        let band = ScoreBand(score: score)

        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(subscription.senderName)
                        .font(.headline)
                    Text(subscription.senderDomain)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if store.groupedCount(for: subscription) > 1 {
                        Label("名寄せ \(store.groupedCount(for: subscription))件", systemImage: "link")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(score)")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(band.color)
                    Text(band.label)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(band.color)
                }
            }

            HStack {
                Label(store.account(for: subscription)?.provider.rawValue ?? "不明", systemImage: "envelope")
                Label(subscription.category.rawValue, systemImage: "tag")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            HStack {
                Text("30日 \(subscription.receiveCount30Days)通")
                Spacer()
                Text("最終開封 \(subscription.lastOpenedDays)日前")
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            if !compact {
                HStack {
                    Button(role: .destructive) {
                        store.unsubscribe(subscription)
                    } label: {
                        Label("解除", systemImage: "trash")
                    }
                    .buttonStyle(.bordered)

                    Button {
                        store.keep(subscription)
                    } label: {
                        Label("保持", systemImage: "checkmark.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct ReportsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            List {
                Section("解除実績") {
                    LabeledContent("解除済み", value: "\(store.unsubscribedSubscriptions.count)件")
                    LabeledContent("推定削減メール", value: "\(store.savedMailCount)通/月")
                    LabeledContent("推定節約時間", value: "\(store.estimatedTimeSavedMinutes)分/月")

                    ForEach(store.unsubscribedSubscriptions) { subscription in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(subscription.senderName)
                                Text(subscription.senderDomain)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Button("戻す") {
                                store.restore(subscription)
                            }
                        }
                    }
                }

                Section("カテゴリ別受信数") {
                    ForEach(categoryReport, id: \.category) { item in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(item.category.rawValue)
                                Spacer()
                                Text("\(item.count)通")
                                    .foregroundStyle(.secondary)
                            }
                            ProgressView(value: Double(item.count), total: Double(maxCategoryCount))
                                .tint(.teal)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("分析")
        }
    }

    private var categoryReport: [(category: SubscriptionCategory, count: Int)] {
        SubscriptionCategory.allCases.map { category in
            let count = store.subscriptions
                .filter { $0.category == category }
                .reduce(0) { $0 + $1.receiveCount30Days }
            return (category, count)
        }
        .filter { $0.count > 0 }
    }

    private var maxCategoryCount: Int {
        categoryReport.map(\.count).max() ?? 1
    }
}

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var opened: Double = 55
    @State private var category: Double = 30
    @State private var frequency: Double = 15

    var body: some View {
        NavigationStack {
            Form {
                Section("スコアリング重み") {
                    SliderRow(title: "最終開封日", value: $opened)
                    SliderRow(title: "カテゴリ", value: $category)
                    SliderRow(title: "受信頻度", value: $frequency)

                    Button("重みを保存") {
                        store.updateWeights(opened: opened, category: category, frequency: frequency)
                    }
                }

                Section("データ") {
                    Button("デモデータに戻す", role: .destructive) {
                        store.resetDemoData()
                        loadWeights()
                    }
                }
            }
            .navigationTitle("設定")
            .onAppear(perform: loadWeights)
        }
    }

    private func loadWeights() {
        opened = store.weights.opened
        category = store.weights.category
        frequency = store.weights.frequency
    }
}

struct MetricCard: View {
    var title: String
    var value: String
    var systemImage: String
    var color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(color)
            Text(value)
                .font(.largeTitle.weight(.bold))
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct SliderRow: View {
    var title: String
    @Binding var value: Double

    var body: some View {
        VStack(alignment: .leading) {
            HStack {
                Text(title)
                Spacer()
                Text("\(Int(value))%")
                    .foregroundStyle(.secondary)
            }
            Slider(value: $value, in: 0...100, step: 1)
        }
    }
}

enum SubscriptionSort: String, CaseIterable, Identifiable {
    case score
    case frequency
    case sender

    var id: String { rawValue }

    var title: String {
        switch self {
        case .score: return "スコア順"
        case .frequency: return "受信頻度順"
        case .sender: return "送信元順"
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppStore())
}
