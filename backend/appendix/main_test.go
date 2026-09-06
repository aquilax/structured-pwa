package main

import (
	"bytes"
	"testing"
)

func testMessage(id MessageID, ts Timestamp) Message {
	return Message{
		ID: id,
		Meta: MessageMeta{
			Namespace: "tasks",
			Operation: MessageOperatorAdd,
			MessageID: EmptyMessageID,
			Timestamp: ts,
		},
		Data: []byte(`{"title":"write tests"}`),
	}
}

func TestProcessPayloadPreservesCursorWhenNoMessagesFollow(t *testing.T) {
	stream := &bytes.Buffer{}
	app := NewApp(stream)
	message := testMessage("tasks.node-a.1", 1)

	if _, err := app.processPayload(&Payload{Cursor: EmptyMessageID, Messages: []Message{message}}); err != nil {
		t.Fatalf("initial processPayload failed: %v", err)
	}

	response, err := app.processPayload(&Payload{Cursor: message.ID, Messages: nil})
	if err != nil {
		t.Fatalf("cursor processPayload failed: %v", err)
	}
	if response.Cursor != message.ID {
		t.Fatalf("cursor = %q, want %q", response.Cursor, message.ID)
	}
	if len(response.Messages) != 0 {
		t.Fatalf("messages = %d, want 0", len(response.Messages))
	}
}

func TestLoadStorageReplaysPersistedMessages(t *testing.T) {
	stream := &bytes.Buffer{}
	writer := NewApp(stream)
	message := testMessage("tasks.node-a.1", 1)
	if _, err := writer.processPayload(&Payload{Cursor: EmptyMessageID, Messages: []Message{message}}); err != nil {
		t.Fatalf("processPayload failed: %v", err)
	}

	reader := NewApp(bytes.NewBuffer(stream.Bytes()))
	if err := reader.loadStorage(); err != nil {
		t.Fatalf("loadStorage failed: %v", err)
	}
	if len(reader.storage) != 1 || reader.storage[0].ID != message.ID {
		t.Fatalf("loaded storage = %#v, want message %q", reader.storage, message.ID)
	}
}
