import { describe, it, expect, vi, beforeEach } from "vitest";
import FileContextMenu from "pages/files/FileContextMenu.vue";
import { useMainStore } from "stores/main-store";
import { mountWithContext } from "../helpers";

const fileProp = {
	row: {
		key: "photos/image.jpg",
		name: "image.jpg",
		nameHash: "aW1hZ2UuanBn",
		type: "file",
		icon: "article",
		color: "grey",
	},
};

const folderProp = {
	row: {
		key: "photos/",
		name: "photos/",
		type: "folder",
		icon: "folder",
		color: "orange",
	},
};

describe("FileContextMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows file-specific items for a file", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const text = wrapper.text();
		expect(text).toContain("contextMenu.open");
		expect(text).toContain("contextMenu.download");
		expect(text).toContain("contextMenu.rename");
		expect(text).toContain("contextMenu.updateMetadata");
		expect(text).toContain("contextMenu.delete");
		expect(text).toContain("contextMenu.createShareLink");
	});

	it("hides file-only items for a folder", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: folderProp },
			initialRoute: "/my-bucket/files",
		});

		const text = wrapper.text();
		expect(text).toContain("contextMenu.open");
		expect(text).toContain("contextMenu.delete");
		expect(text).not.toContain("contextMenu.download");
		expect(text).not.toContain("contextMenu.rename");
		expect(text).not.toContain("contextMenu.updateMetadata");
		expect(text).not.toContain("contextMenu.createShareLink");
	});

	it("shows Copy Public URL when bucket has publicUrl", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const store = useMainStore();
		store.buckets = [
			{ name: "my-bucket", publicUrl: "https://cdn.example.com" },
		] as any;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain("contextMenu.copyPublicUrl");
	});

	it("hides Copy Public URL when no publicUrl", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const store = useMainStore();
		store.buckets = [{ name: "my-bucket" }] as any;
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).not.toContain("contextMenu.copyPublicUrl");
	});

	it("emits openObject when Open is clicked", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		// Find the QItem stub containing the open key and click it
		const items = wrapper.findAllComponents({ name: "QItem" });
		const openItem = items.find((i) => i.text().includes("contextMenu.open"));
		await openItem!.trigger("click");

		expect(wrapper.emitted("openObject")).toBeTruthy();
	});

	it("emits deleteObject when Delete is clicked", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		const items = wrapper.findAllComponents({ name: "QItem" });
		const deleteItem = items.find((i) => i.text().includes("contextMenu.delete"));
		await deleteItem!.trigger("click");

		expect(wrapper.emitted("deleteObject")).toBeTruthy();
	});

	it("computes selectedBucket from route", async () => {
		const wrapper = await mountWithContext(FileContextMenu, {
			props: { prop: fileProp },
			initialRoute: "/my-bucket/files",
		});

		expect(wrapper.vm.selectedBucket).toBe("my-bucket");
	});
});
